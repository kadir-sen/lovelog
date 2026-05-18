import {
  BehavioralPattern,
  DailyStats,
  NormalizedMessage,
  PatternEvidence,
  PatternId,
  PeriodSummary,
} from '../types';

const pad = (v: number) => String(v).padStart(2, '0');

const getWeekKey = (date: Date): string => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${pad(week)}`;
};

const truncate = (text: string, max = 150): string => {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
};

const anonymizeText = (text: string): string => {
  const clean = text
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[email]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[telefon]')
    .replace(/\b\d{4,}\b/g, '[sayı]');
  return truncate(clean);
};

const STONEWALL_GAP_MINUTES = 360;
const STONEWALL_SHORT_REPLY_RUN = 3;
const ATTACK_APOLOGY_WINDOW_MINUTES = 24 * 60;
const ATTACK_APOLOGY_REPEAT_WINDOW_DAYS = 30;
const PLAN_CANCEL_WINDOW_MINUTES = 48 * 60;
const RECIPROCITY_MIN_WEEKS = 8;
const RECIPROCITY_DECLINE_THRESHOLD = 0.3;

const CANCELLATION_REGEX =
  /(?<![\p{L}\p{M}])(?:iptal|erteley|ertelemek|ertele(?:dim|yelim)?|gelemiyorum|gelemem|gelemeyeceğim|yapamıyorum|yapamam|olmuyor|olmayacak|olmaz|kalmasın|kalsın|vazgeçtim|vazgeç|uygun değilim|denk gelmedi|gidemem|gidemiyorum|kalamam|kalamıyorum|m[üu]sait değil)(?![\p{L}\p{M}])/iu;

const REPAIR_OR_WARM_REGEX =
  /(?<![\p{L}\p{M}])(?:telafi|özür|pardon|haklısın|konuşalım|çözelim|seviyorum|aşkım|canım|iyi ki|günaydın|iyi geceler|merak etme)(?![\p{L}\p{M}])/iu;

const hasCancellation = (text: string): boolean => CANCELLATION_REGEX.test(text);

const hasRepairOrWarmth = (msg: NormalizedMessage): boolean =>
  msg.adjustedSignals.love > 0 ||
  msg.signals.apology > 0 ||
  msg.signals.thanks > 0 ||
  REPAIR_OR_WARM_REGEX.test(msg.content);

const buildEvidence = (
  msg: NormalizedMessage,
  role: PatternEvidence['role']
): PatternEvidence => ({
  date: msg.dateKey,
  author: msg.author,
  text: anonymizeText(msg.content),
  role,
  messageId: msg.id,
});

const clampSeverity = (raw: number, scale: number): number => {
  if (!isFinite(raw) || raw <= 0) return 0;
  return Math.min(1, raw / scale);
};

const confidenceFrom = (occurrences: number, evidenceCount: number, hasCounterEvidence: boolean): number => {
  const base = 0.48 + Math.min(0.28, occurrences * 0.07) + Math.min(0.14, evidenceCount * 0.035);
  return Number(Math.max(0, Math.min(0.92, base - (hasCounterEvidence ? 0.05 : 0))).toFixed(2));
};

const formatDateRange = (msgs: NormalizedMessage[]): { start: string; end: string } => {
  if (!msgs.length) return { start: '', end: '' };
  const sorted = [...msgs].sort((a, b) => a.date.getTime() - b.date.getTime());
  return { start: sorted[0].dateKey, end: sorted[sorted.length - 1].dateKey };
};

const isAttack = (msg: NormalizedMessage): boolean =>
  msg.adjustedSignals.harsh >= 1 || msg.adjustedSignals.tension >= 2 || msg.signals.jealousy >= 1;

const isApology = (msg: NormalizedMessage): boolean => msg.signals.apology >= 1;

const isPlanProposal = (msg: NormalizedMessage): boolean =>
  msg.signals.planning >= 1 || msg.signals.future >= 1;

export const detectStonewalling = (
  messages: NormalizedMessage[],
  authors: string[]
): BehavioralPattern[] => {
  if (messages.length < 4 || authors.length < 2) return [];

  const patterns: BehavioralPattern[] = [];

  for (const silentAuthor of authors) {
    const otherAuthor = authors.find(a => a !== silentAuthor);
    if (!otherAuthor) continue;

    const occurrences: Array<{ trigger: NormalizedMessage; silenceMinutes: number; followUps: NormalizedMessage[] }> = [];

    for (let i = 0; i < messages.length - 1; i++) {
      const trigger = messages[i];
      if (trigger.author !== otherAuthor) continue;
      if (!isAttack(trigger) && trigger.adjustedSignals.tension === 0 && trigger.signals.jealousy === 0) continue;

      let nextSilentIdx = -1;
      for (let j = i + 1; j < messages.length; j++) {
        if (messages[j].author === silentAuthor) {
          nextSilentIdx = j;
          break;
        }
      }

      if (nextSilentIdx === -1) {
        const tailMinutes = (messages[messages.length - 1].date.getTime() - trigger.date.getTime()) / 60000;
        if (tailMinutes >= STONEWALL_GAP_MINUTES) {
          occurrences.push({ trigger, silenceMinutes: tailMinutes, followUps: [] });
        }
        continue;
      }

      const responseGap = (messages[nextSilentIdx].date.getTime() - trigger.date.getTime()) / 60000;
      if (responseGap >= STONEWALL_GAP_MINUTES) {
        occurrences.push({ trigger, silenceMinutes: responseGap, followUps: [messages[nextSilentIdx]] });
        continue;
      }

      let runStart = nextSilentIdx;
      let shortRun = 0;
      const runMessages: NormalizedMessage[] = [];
      for (let k = nextSilentIdx; k < messages.length && shortRun < STONEWALL_SHORT_REPLY_RUN + 2; k++) {
        if (messages[k].author !== silentAuthor) break;
        if (messages[k].isShortReply) {
          shortRun++;
          runMessages.push(messages[k]);
        } else {
          break;
        }
      }
      if (shortRun >= STONEWALL_SHORT_REPLY_RUN) {
        const lastRun = runMessages[runMessages.length - 1];
        const runGap = (lastRun.date.getTime() - messages[runStart].date.getTime()) / 60000;
        occurrences.push({ trigger, silenceMinutes: Math.max(runGap, 60), followUps: runMessages });
      }
    }

    if (occurrences.length < 3) continue;

    const avgSilence = occurrences.reduce((acc, o) => acc + o.silenceMinutes, 0) / occurrences.length;
    const evidenceMessages = occurrences
      .slice(0, 3)
      .flatMap(o => [buildEvidence(o.trigger, 'trigger'), ...o.followUps.slice(0, 1).map(m => buildEvidence(m, 'response'))]);
    const counterEvidence = occurrences
      .flatMap(o => o.followUps)
      .filter(hasRepairOrWarmth)
      .slice(0, 3)
      .map(m => buildEvidence(m, 'response'));

    const allMsgs = occurrences.flatMap(o => [o.trigger, ...o.followUps]);
    patterns.push({
      id: 'stonewalling',
      label: 'Uzun sessizlik örüntüsü',
      description: `${silentAuthor} tarafında gerilimden sonra ${occurrences.length} kez uzun yanıt aralığı veya kısa cevap kümelenmesi görünüyor; bu tek başına niyet yorumu değildir.`,
      severity: clampSeverity(occurrences.length * (avgSilence / 60), 60),
      confidence: confidenceFrom(occurrences.length, evidenceMessages.length, counterEvidence.length > 0),
      occurrenceCount: occurrences.length,
      perpetrator: silentAuthor,
      victim: otherAuthor,
      dateRange: formatDateRange(allMsgs),
      evidence: evidenceMessages.slice(0, 4),
      counterEvidence,
    });
  }

  return patterns;
};

export const detectAttackApologyLoop = (
  messages: NormalizedMessage[],
  authors: string[]
): BehavioralPattern[] => {
  if (messages.length < 4) return [];

  const patterns: BehavioralPattern[] = [];

  for (const author of authors) {
    const cycles: Array<{ attack: NormalizedMessage; apology: NormalizedMessage }> = [];

    for (let i = 0; i < messages.length; i++) {
      const attack = messages[i];
      if (attack.author !== author) continue;
      if (!isAttack(attack)) continue;

      for (let j = i + 1; j < messages.length; j++) {
        const candidate = messages[j];
        if (candidate.author !== author) continue;
        const diffMinutes = (candidate.date.getTime() - attack.date.getTime()) / 60000;
        if (diffMinutes > ATTACK_APOLOGY_WINDOW_MINUTES) break;
        if (isApology(candidate)) {
          cycles.push({ attack, apology: candidate });
          break;
        }
      }
    }

    if (cycles.length < 2) continue;

    let maxRepeats = 0;
    for (let i = 0; i < cycles.length; i++) {
      let count = 1;
      for (let j = i + 1; j < cycles.length; j++) {
        const dayDiff = (cycles[j].attack.date.getTime() - cycles[i].attack.date.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff <= ATTACK_APOLOGY_REPEAT_WINDOW_DAYS) count++;
        else break;
      }
      if (count > maxRepeats) maxRepeats = count;
    }
    if (maxRepeats < 2) continue;

    const avgIntensity = cycles.reduce((acc, c) => acc + (c.attack.adjustedSignals.harsh + c.attack.adjustedSignals.tension), 0) / cycles.length;
    const allMsgs = cycles.flatMap(c => [c.attack, c.apology]);
    const otherAuthor = authors.find(a => a !== author);

    const evidence: PatternEvidence[] = cycles
      .slice(0, 2)
      .flatMap(c => [buildEvidence(c.attack, 'trigger'), buildEvidence(c.apology, 'response')]);

    patterns.push({
      id: 'attack_apology_loop',
      label: 'Saldırı–özür döngüsü',
      description: `${author}, sert/gerilimli mesajdan kısa süre sonra ${cycles.length} kez özür diliyor; tekrar eden bir döngü görünüyor.`,
      severity: clampSeverity(cycles.length * (1 + avgIntensity), 8),
      confidence: confidenceFrom(cycles.length, evidence.length, false),
      occurrenceCount: cycles.length,
      perpetrator: author,
      victim: otherAuthor,
      dateRange: formatDateRange(allMsgs),
      evidence: evidence.slice(0, 4),
      counterEvidence: [],
    });
  }

  return patterns;
};

export const detectPlanCancellation = (
  messages: NormalizedMessage[],
  authors: string[]
): BehavioralPattern[] => {
  if (messages.length < 4 || authors.length < 2) return [];

  const patterns: BehavioralPattern[] = [];

  for (const cancellingAuthor of authors) {
    const otherAuthor = authors.find(a => a !== cancellingAuthor);
    if (!otherAuthor) continue;

    const cancellations: Array<{ proposal: NormalizedMessage; cancel: NormalizedMessage }> = [];

    for (let i = 0; i < messages.length; i++) {
      const proposal = messages[i];
      if (!isPlanProposal(proposal)) continue;

      for (let j = i + 1; j < messages.length; j++) {
        const candidate = messages[j];
        const diffMinutes = (candidate.date.getTime() - proposal.date.getTime()) / 60000;
        if (diffMinutes > PLAN_CANCEL_WINDOW_MINUTES) break;
        if (candidate.author !== cancellingAuthor) continue;
        if (candidate.isMedia) continue;
        if (candidate.negationFlag) continue;
        if (hasCancellation(candidate.content)) {
          cancellations.push({ proposal, cancel: candidate });
          break;
        }
      }
    }

    if (cancellations.length < 2) continue;

    const allMsgs = cancellations.flatMap(c => [c.proposal, c.cancel]);
    const evidence: PatternEvidence[] = cancellations
      .slice(0, 2)
      .flatMap(c => [buildEvidence(c.proposal, 'trigger'), buildEvidence(c.cancel, 'response')]);
    const counterEvidence: PatternEvidence[] = cancellations
      .flatMap(c => {
        const cancelIndex = messages.findIndex(m => m.id === c.cancel.id);
        return messages
          .slice(cancelIndex + 1, cancelIndex + 20)
          .filter(m => m.author === cancellingAuthor && (hasRepairOrWarmth(m) || isPlanProposal(m)))
          .slice(0, 1);
      })
      .slice(0, 3)
      .map(m => buildEvidence(m, 'response'));

    patterns.push({
      id: 'plan_cancellation',
      label: 'Plan iptal kalıbı',
      description: `${cancellingAuthor}, planlardan sonra ${cancellations.length} kez iptal/erteleme yönünde mesaj atmış${counterEvidence.length ? '; bazı örneklerde telafi veya yeniden planlama sinyali de var.' : '.'}`,
      severity: clampSeverity(cancellations.length, 6),
      confidence: confidenceFrom(cancellations.length, evidence.length, counterEvidence.length > 0),
      occurrenceCount: cancellations.length,
      perpetrator: cancellingAuthor,
      victim: otherAuthor,
      dateRange: formatDateRange(allMsgs),
      evidence: evidence.slice(0, 4),
      counterEvidence,
    });
  }

  return patterns;
};

export const detectReciprocityDecline = (
  messages: NormalizedMessage[],
  authors: string[],
  dailyStats: DailyStats[]
): BehavioralPattern[] => {
  if (messages.length < 50 || authors.length < 2) return [];

  const weekTotals: Record<string, { total: number; perAuthor: Record<string, number>; firstDate: string }> = {};
  for (const msg of messages) {
    const wk = msg.weekKey;
    if (!weekTotals[wk]) {
      weekTotals[wk] = { total: 0, perAuthor: Object.fromEntries(authors.map(a => [a, 0])), firstDate: msg.dateKey };
    }
    weekTotals[wk].total += 1;
    if (weekTotals[wk].perAuthor[msg.author] !== undefined) {
      weekTotals[wk].perAuthor[msg.author] += 1;
    }
  }

  const weekKeys = Object.keys(weekTotals).sort();
  if (weekKeys.length < RECIPROCITY_MIN_WEEKS) return [];

  const halfSize = Math.min(4, Math.floor(weekKeys.length / 2));
  const earlyKeys = weekKeys.slice(0, halfSize);
  const lateKeys = weekKeys.slice(-halfSize);

  const patterns: BehavioralPattern[] = [];

  for (const author of authors) {
    const otherAuthor = authors.find(a => a !== author);
    if (!otherAuthor) continue;

    const earlyShareSum = earlyKeys.reduce((acc, wk) => {
      const w = weekTotals[wk];
      return acc + (w.total > 0 ? w.perAuthor[author] / w.total : 0);
    }, 0);
    const earlyShare = earlyShareSum / Math.max(1, earlyKeys.length);

    const lateShareSum = lateKeys.reduce((acc, wk) => {
      const w = weekTotals[wk];
      return acc + (w.total > 0 ? w.perAuthor[author] / w.total : 0);
    }, 0);
    const lateShare = lateShareSum / Math.max(1, lateKeys.length);

    if (earlyShare <= 0.05) continue;
    const drop = (earlyShare - lateShare) / earlyShare;
    if (drop < RECIPROCITY_DECLINE_THRESHOLD) continue;

    const earlyAuthorMsgs = messages.filter(m => earlyKeys.includes(m.weekKey) && m.author === author && !m.isMedia).slice(0, 1);
    const lateAuthorMsgs = messages.filter(m => lateKeys.includes(m.weekKey) && !m.isMedia).slice(-2);
    const evidence: PatternEvidence[] = [
      ...earlyAuthorMsgs.map(m => buildEvidence(m, 'context')),
      ...lateAuthorMsgs.map(m => buildEvidence(m, 'context')),
    ];

    const dateRangeMsgs = [...earlyAuthorMsgs, ...lateAuthorMsgs];
    const dr = dateRangeMsgs.length
      ? formatDateRange(dateRangeMsgs)
      : { start: dailyStats[0]?.date || '', end: dailyStats[dailyStats.length - 1]?.date || '' };

    patterns.push({
      id: 'reciprocity_decline',
      label: 'Karşılıklılık değişimi',
      description: `${author} taraflı katkı ilk dönemde %${Math.round(earlyShare * 100)}, son dönemde %${Math.round(lateShare * 100)}; haftalara yayılan belirgin bir ritim değişimi.`,
      severity: clampSeverity(drop * weekKeys.length, 12),
      confidence: Number(Math.min(0.9, 0.62 + drop * 0.25 + weekKeys.length * 0.01).toFixed(2)),
      occurrenceCount: weekKeys.length,
      perpetrator: author,
      victim: otherAuthor,
      dateRange: dr,
      evidence: evidence.slice(0, 4),
      counterEvidence: [],
    });
  }

  return patterns;
};

export const detectRepairImbalance = (
  messages: NormalizedMessage[],
  authors: string[]
): BehavioralPattern[] => {
  if (messages.length < 20 || authors.length < 2) return [];

  const repairMessages = messages.filter(m =>
    !m.isMedia &&
    (m.signals.apology >= 1 || /haklısın|telafi|konuşup çözelim|çözelim|düzelt/i.test(m.content))
  );
  if (repairMessages.length < 4) return [];

  const counts = Object.fromEntries(authors.map(a => [a, 0]));
  repairMessages.forEach(m => {
    if (counts[m.author] !== undefined) counts[m.author]++;
  });

  const total = authors.reduce((sum, a) => sum + (counts[a] || 0), 0);
  if (total < 4) return [];

  const patterns: BehavioralPattern[] = [];
  for (const author of authors) {
    const share = (counts[author] || 0) / total;
    if (share < 0.8) continue;
    const otherAuthor = authors.find(a => a !== author);
    const authorRepairs = repairMessages.filter(m => m.author === author);
    const otherRepairs = otherAuthor ? repairMessages.filter(m => m.author === otherAuthor) : [];
    const evidence = authorRepairs.slice(0, 3).map(m => buildEvidence(m, 'response'));
    const counterEvidence = otherRepairs.slice(0, 2).map(m => buildEvidence(m, 'response'));
    patterns.push({
      id: 'repair_imbalance',
      label: 'Onarım dengesi',
      description: `Onarım/özür sinyallerinin %${Math.round(share * 100)} kadarı ${author} tarafından geliyor; bu emek dağılımı olarak, kesin niyet yorumu olmadan okunmalı.`,
      severity: clampSeverity(share * total, 8),
      confidence: confidenceFrom(total, evidence.length + counterEvidence.length, counterEvidence.length > 0),
      occurrenceCount: total,
      perpetrator: author,
      victim: otherAuthor,
      dateRange: formatDateRange(repairMessages),
      evidence,
      counterEvidence,
    });
  }

  return patterns;
};

export const detectWarmthDecline = (
  messages: NormalizedMessage[],
  authors: string[]
): BehavioralPattern[] => {
  if (messages.length < 80) return [];
  const weekTotals: Record<string, { total: number; warm: number; short: number; firstDate: string }> = {};
  for (const msg of messages) {
    const wk = msg.weekKey;
    if (!weekTotals[wk]) weekTotals[wk] = { total: 0, warm: 0, short: 0, firstDate: msg.dateKey };
    weekTotals[wk].total++;
    weekTotals[wk].warm += msg.adjustedSignals.love + msg.signals.emotional + msg.signals.thanks + msg.emojiCount * 0.2;
    weekTotals[wk].short += msg.isShortReply ? 1 : 0;
  }
  const keys = Object.keys(weekTotals).sort();
  if (keys.length < 8) return [];
  const halfSize = Math.min(4, Math.floor(keys.length / 2));
  const early = keys.slice(0, halfSize);
  const late = keys.slice(-halfSize);
  const avgWarmRate = (set: string[]) => set.reduce((sum, k) => {
    const w = weekTotals[k];
    return sum + (w.total ? w.warm / w.total : 0);
  }, 0) / set.length;
  const avgShortRate = (set: string[]) => set.reduce((sum, k) => {
    const w = weekTotals[k];
    return sum + (w.total ? w.short / w.total : 0);
  }, 0) / set.length;
  const earlyWarm = avgWarmRate(early);
  const lateWarm = avgWarmRate(late);
  const earlyShort = avgShortRate(early);
  const lateShort = avgShortRate(late);
  if (earlyWarm < 0.05 || (earlyWarm - lateWarm) / earlyWarm < 0.35 || lateShort <= earlyShort) return [];

  const evidenceMsgs = [
    ...messages.filter(m => early.includes(m.weekKey) && !m.isMedia && (m.adjustedSignals.love > 0 || m.emojiCount > 0)).slice(0, 2),
    ...messages.filter(m => late.includes(m.weekKey) && !m.isMedia && m.isShortReply).slice(-2),
  ];
  const counterEvidence = messages
    .filter(m => late.includes(m.weekKey) && hasRepairOrWarmth(m))
    .slice(0, 2)
    .map(m => buildEvidence(m, 'context'));
  const evidence = evidenceMsgs.map(m => buildEvidence(m, 'context')).slice(0, 4);

  return [{
    id: 'hot_cold_cycle',
    label: 'Sıcaklık ritmi değişimi',
    description: `İlk haftalara göre son haftalarda sıcak mesaj oranı azalırken kısa cevap oranı artmış; bu dönemsel ritim değişimi olarak gösterildi.`,
    severity: clampSeverity(((earlyWarm - lateWarm) / Math.max(earlyWarm, 0.01)) + (lateShort - earlyShort), 2),
    confidence: confidenceFrom(keys.length, evidence.length, counterEvidence.length > 0),
    occurrenceCount: keys.length,
    perpetrator: undefined,
    victim: authors[0],
    dateRange: formatDateRange(evidenceMsgs),
    evidence,
    counterEvidence,
  }];
};

export const detectPatterns = (
  messages: NormalizedMessage[],
  authors: string[],
  dailyStats: DailyStats[],
  _periodSummaries: PeriodSummary[]
): BehavioralPattern[] => {
  const all = [
    ...detectStonewalling(messages, authors),
    ...detectAttackApologyLoop(messages, authors),
    ...detectPlanCancellation(messages, authors),
    ...detectReciprocityDecline(messages, authors, dailyStats),
    ...detectRepairImbalance(messages, authors),
    ...detectWarmthDecline(messages, authors),
  ];
  return all.sort((a, b) => b.severity - a.severity).slice(0, 8);
};

export const matchPatternsToQuery = (
  query: string,
  patterns: BehavioralPattern[]
): BehavioralPattern[] => {
  if (!patterns.length) return [];
  const q = query.toLocaleLowerCase('tr-TR');
  const intentRegex = /manip[üu]le|gaslighting|sessiz|trip|iptal|k[ıi]skan[çc]|s[üu]rekli|hep ayn[ıi]|d[öo]ng[üu]|kal[ıi]p|niye b[öo]yle|niye hep|sald[ıi]r|[öo]z[üu]r|so[ğg]u|ghosting|ka[çc]|aldat|bık|pl[aá]n/i;

  const dateMatch = q.match(/\b20\d{2}-\d{2}-\d{2}\b/);
  const explicitDate = dateMatch ? dateMatch[0] : null;

  const idHints: Array<{ id: PatternId; regex: RegExp }> = [
    { id: 'stonewalling', regex: /sessiz|trip|so[ğg]u|cevap vermiyor|kü[sş]|ghosting/i },
    { id: 'attack_apology_loop', regex: /[öo]z[üu]r|sald[ıi]r|sert|kavga|tart[ıi][şs]|ba[ğg][ıi]r/i },
    { id: 'plan_cancellation', regex: /iptal|ertel|gelm|gelemiyor|plan|bulu[şs]/i },
    { id: 'reciprocity_decline', regex: /kar[şs][ıi]l[ıi]k|dengesiz|hep ben|ilg[iı]siz|az yaz|b[ıi]kt[ıi]/i },
  ];

  const hasIntent = intentRegex.test(q);
  const hintedIds = new Set(idHints.filter(h => h.regex.test(q)).map(h => h.id));

  const matched = patterns.filter(p => {
    if (explicitDate && p.dateRange.start <= explicitDate && p.dateRange.end >= explicitDate) return true;
    if (hintedIds.has(p.id)) return true;
    if (hasIntent && p.severity > 0.4) return true;
    return false;
  });

  if (matched.length === 0 && patterns[0] && patterns[0].severity > 0.6) {
    return [patterns[0]];
  }

  return matched.sort((a, b) => b.severity - a.severity).slice(0, 3);
};

if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
  const baseDate = (offset: number, h = 10, m = 0): Date => {
    const d = new Date(2025, 0, 1, h, m, 0);
    d.setDate(d.getDate() + offset);
    return d;
  };
  const mkMsg = (
    id: number,
    date: Date,
    author: string,
    content: string,
    overrides: Partial<NormalizedMessage> = {}
  ): NormalizedMessage => {
    const lower = content.toLowerCase();
    const harsh = /aptal|salak|nefret|defol|siktir|yalanc/i.test(lower) ? 1 : 0;
    const tension = /kavga|tart[ıi][şs]|sinir|yeter|b[ıi]kt|sorun|so[ğg]uk/i.test(lower) ? 1 : 0;
    const apology = /[öo]z[üu]r|pardon|kusura/i.test(lower) ? 1 : 0;
    const planning = /yar[ıi]n|bulu[şs]|gidelim|plan|saat|hafta sonu/i.test(lower) ? 1 : 0;
    const future = /yapaca[ğg][ıi]z|gidece[ğg]iz|olacak/i.test(lower) ? 1 : 0;
    return {
      id,
      date,
      author,
      content,
      isMedia: false,
      dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      weekKey: getWeekKey(date),
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      wordCount: content.split(/\s+/).length,
      charCount: content.length,
      emojiCount: 0,
      hasQuestion: content.includes('?'),
      hasExclamation: content.includes('!'),
      hasUrl: false,
      isShortReply: content.split(/\s+/).length <= 3 && content.length <= 25,
      clauses: [content],
      playfulnessFlag: false,
      negationFlag: false,
      signals: { love: 0, emotional: 0, apology, thanks: 0, planning, future, jealousy: 0, tension, harsh },
      adjustedSignals: { love: 0, emotional: 0, tension, harsh },
      ...overrides,
    };
  };

  const stonewallFixture: NormalizedMessage[] = [];
  let mid = 0;
  for (let cycle = 0; cycle < 3; cycle++) {
    stonewallFixture.push(mkMsg(mid++, baseDate(cycle * 5, 10), 'Ali', 'kavga ediyor musun benimle yine'));
    stonewallFixture.push(mkMsg(mid++, baseDate(cycle * 5, 19), 'Ayşe', 'tamam.'));
  }
  const stonewallResult = detectStonewalling(stonewallFixture, ['Ali', 'Ayşe']);

  const attackApologyFixture: NormalizedMessage[] = [];
  mid = 0;
  for (let cycle = 0; cycle < 3; cycle++) {
    attackApologyFixture.push(mkMsg(mid++, baseDate(cycle * 7, 14), 'Ali', 'salak mısın'));
    attackApologyFixture.push(mkMsg(mid++, baseDate(cycle * 7, 15), 'Ali', 'özür dilerim aşkım'));
  }
  const aaResult = detectAttackApologyLoop(attackApologyFixture, ['Ali', 'Ayşe']);

  const planCancelFixture: NormalizedMessage[] = [];
  mid = 0;
  for (let cycle = 0; cycle < 2; cycle++) {
    planCancelFixture.push(mkMsg(mid++, baseDate(cycle * 10, 9), 'Ayşe', 'yarın buluşalım mı'));
    planCancelFixture.push(mkMsg(mid++, baseDate(cycle * 10 + 1, 18), 'Ali', 'iptal edelim ya yapamayacağım'));
  }
  const pcResult = detectPlanCancellation(planCancelFixture, ['Ali', 'Ayşe']);

  const reciprocityFixture: NormalizedMessage[] = [];
  mid = 0;
  for (let week = 0; week < 8; week++) {
    const aliShare = week < 4 ? 5 : 1;
    const ayseShare = 5;
    for (let i = 0; i < aliShare; i++) {
      reciprocityFixture.push(mkMsg(mid++, baseDate(week * 7 + i, 10), 'Ali', `mesaj a-${week}-${i}`));
    }
    for (let i = 0; i < ayseShare; i++) {
      reciprocityFixture.push(mkMsg(mid++, baseDate(week * 7 + i, 11), 'Ayşe', `mesaj b-${week}-${i}`));
    }
  }
  const dailyStub: DailyStats[] = [];
  const recipResult = detectReciprocityDecline(reciprocityFixture, ['Ali', 'Ayşe'], dailyStub);

  const expectations: Array<[string, boolean]> = [
    ['stonewalling 3 tekrar tespit', stonewallResult.length === 1 && stonewallResult[0].occurrenceCount >= 3 && stonewallResult[0].perpetrator === 'Ayşe'],
    ['attack-apology 3 döngü tespit', aaResult.length === 1 && aaResult[0].occurrenceCount >= 3 && aaResult[0].perpetrator === 'Ali'],
    ['plan iptal 2 tekrar tespit', pcResult.length === 1 && pcResult[0].occurrenceCount >= 2 && pcResult[0].perpetrator === 'Ali'],
    ['karşılıklılık çöküşü Ali için tespit', recipResult.some(p => p.perpetrator === 'Ali')],
    ['negation/playfulness false-positive yok', detectAttackApologyLoop([
      mkMsg(0, baseDate(0, 10), 'Ali', 'salak değilsin', { negationFlag: true, adjustedSignals: { love: 0, emotional: 0, tension: 0, harsh: 0 }, signals: { love: 0, emotional: 0, apology: 0, thanks: 0, planning: 0, future: 0, jealousy: 0, tension: 0, harsh: 0 } }),
      mkMsg(1, baseDate(0, 11), 'Ali', 'özür dilerim'),
    ], ['Ali', 'Ayşe']).length === 0],
  ];
  const failed = expectations.filter(([, ok]) => !ok).map(([n]) => n);
  if (failed.length) {
    // eslint-disable-next-line no-console
    console.warn('[pattern self-check] başarısız beklentiler:', failed, { stonewallResult, aaResult, pcResult, recipResult });
  }
}
