import {
  AnalysisResult,
  BehavioralPattern,
  DailyStats,
  EvidenceItem,
  LoveWordStat,
  NormalizedMessage,
  ParticipantStats,
  PeriodSummary,
} from '../types';

export type RelationshipMode = 'lover' | 'friend';

export interface PersonReportStats {
  name: string;
  messageCount: number;
  wordCount: number;
  mediaCount: number;
  emojiCount: number;
  questionCount: number;
  questionRate: number;
  loveSignalCount: number;
  loveSignalRate: number;
  conversationStarts: number;
  averageResponseTime: number;
  medianResponseTime: number;
  averageMessageLength: number;
}

export interface ReportMetric {
  label: string;
  value: number | string;
  description: string;
  score?: number;
}

export interface ReportProfile {
  title: string;
  winner: string;
  score: number;
  description: string;
  personAValue: number;
  personBValue: number;
}

export interface TimelineItem {
  date: string;
  title: string;
  description: string;
  value: number | string;
  icon: string;
}

export interface MonthlyIntensityPoint {
  key: string;
  messages: number;
  personA: number;
  personB: number;
  love: number;
  chaos: number;
}

export interface DailyMessagePoint {
  date: string;
  total: number;
  personA: number;
  personB: number;
}

export interface CalendarDayReport {
  date: string;
  total: number;
  personA: number;
  personB: number;
  loveScore: number;
  chaosScore: number;
  mediaCount: number;
  emojiCount: number;
  topEmojis: Array<{ emoji: string; count: number }>;
  topEmojiPairs: Array<{ pair: string; count: number }>;
  topLoveWords: Array<{ word: string; count: number }>;
  hourlyFlow: Array<{ hour: number; total: number; personA: number; personB: number; warmth: number; tension: number }>;
  busiestHour?: number;
  warmestHour?: number;
  tensestHour?: number;
  rituals: Array<{ kind: string; count: number }>;
  evidence: EvidenceItem[];
  counterEvidence: EvidenceItem[];
  shortReplyClusters: number;
  planSignals: number;
  repairSignals: number;
  insight: string;
}

export interface EmojiPairReport {
  pair: string;
  count: number;
  byPerson: Record<string, number>;
  timeline: Array<{ date: string; count: number }>;
  semantic: 'affection' | 'humor' | 'celebration' | 'mixed' | 'other';
}

export interface RelationshipReport {
  couple: {
    personAName: string;
    personBName: string;
  };
  overview: {
    totalMessages: number;
    totalWords: number;
    dateRange: { start: Date; end: Date };
    activeDays: number;
    averageMessagesPerDay: number;
    analysisDate: Date;
    aiSummary: string;
  };
  people: {
    personA: PersonReportStats;
    personB: PersonReportStats;
  };
  profiles: {
    emotional: ReportProfile;
    curious: ReportProfile;
    interested: ReportProfile;
  };
  privacy: {
    rawChatSentToLLM: false;
    anonymizedPayload: true;
    note: string;
  };
  deepAnalysis: {
    questions: ReportMetric;
    shortReplies: ReportMetric;
    plans: ReportMetric;
    signals: ReportMetric;
    tension: ReportMetric;
  };
  timeline: {
    mostActiveDay?: TimelineItem;
    longestSilence?: TimelineItem;
    chaoticPeriod?: TimelineItem;
    sweetestPeriod?: TimelineItem;
  };
  charts: {
    dailyMessages: DailyMessagePoint[];
    monthlyIntensity: MonthlyIntensityPoint[];
    hourlyActivity: Array<{ hour: number; count: number }>;
    responseSpeedDistribution: AnalysisResult['responseTimeBuckets'];
  };
  loveDictionary: LoveWordStat[];
  scoreCards: {
    sweetest?: ReportMetric;
    chaotic?: ReportMetric;
    quietest?: ReportMetric;
  };
  media: {
    personA: number;
    personB: number;
    total: number;
    rate: number;
  };
  flow: {
    totalFlowHours: number;
    longestFlowMinutes: number;
    sessionCount: number;
    averageFlowMinutes: number;
  };
  calendar: CalendarDayReport[];
  emoji: {
    topOverall: Array<{
      emoji: string;
      count: number;
      byPerson: Record<string, number>;
      timeline: Array<{ date: string; count: number }>;
    }>;
    byPerson: Record<string, Array<{ emoji: string; count: number }>>;
    topPairs: EmojiPairReport[];
    loveEmojiCount: number;
    laughEmojiCount: number;
  };
  patterns: BehavioralPattern[];
  narratives: {
    loveLanguage: string;
    communicationBalance: string;
    responseRhythm: string;
    evidenceBasedFun: string;
    shortNote: string;
    funFact: string;
  };
}

const LOVE_EMOJIS = new Set(['❤', '❤️', '♥', '💕', '💖', '💗', '💘', '💞', '💓', '🤍', '😘', '😚', '🥰', '😍']);
const LAUGH_EMOJIS = new Set(['😂', '🤣', '😅', '😁', '😄', '😆']);
const CELEBRATION_EMOJIS = new Set(['🥳', '🎉', '✨', '⭐', '🌟']);
const SESSION_GAP_MINUTES = 120;
const FLOW_GAP_MINUTES = 30;
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
const SUPPORT_KEYWORDS = ['yanındayım', 'dinlerim', 'anlat', 'üzülme', 'merak etme', 'haklısın', 'geçer', 'seni anlıyorum', 'iyi misin', 'yardım', 'destek', 'sarıl', 'gurur', 'başar'];
const FUN_KEYWORDS = ['kanka', 'kankam', 'bestie', 'dedikodu', 'tea', 'şaka', 'komik', 'güldüm', 'ahah', 'hahaha', 'asdad', 'slay', 'kraliçe', 'susss', 'deli misin'];
const FRIEND_DRAMA_KEYWORDS = ['drama', 'trip', 'küstüm', 'küs', 'boşver', 'neyse', 'sinir', 'ayıp', 'kırıldım', 'soğuk', 'iptal', 'yazmadın', 'görüldü', 'umursamadın'];

const formatMinutes = (minutes: number): string => {
  if (!minutes) return 'veri yok';
  if (minutes < 1) return '<1 dk';
  if (minutes < 60) return `${Math.round(minutes)} dk`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} sa`;
  return `${(hours / 24).toFixed(1)} gün`;
};

const dateLabel = (date: string | Date): string => new Date(date).toLocaleDateString('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: '2-digit',
});

const safePct = (value: number, total: number): number => total ? Math.round((value / total) * 1000) / 10 : 0;

const countKeywordHits = (content: string, keywords: string[]): number => {
  const lower = content.toLocaleLowerCase('tr-TR');
  return keywords.reduce((total, keyword) => total + (lower.includes(keyword) ? 1 : 0), 0);
};

const normalizeEmojiForReport = (emoji: string): string => emoji === '❤' ? '❤️' : emoji;

const extractEmojiSequence = (content: string): string[] =>
  (content.match(EMOJI_REGEX) || []).map(normalizeEmojiForReport);

const extractEmojiPairs = (content: string): string[] => {
  const emojis = extractEmojiSequence(content);
  const pairs: string[] = [];
  for (let i = 1; i < emojis.length; i++) {
    pairs.push(`${emojis[i - 1]}${emojis[i]}`);
  }
  return pairs;
};

const classifyEmojiPair = (pair: string): EmojiPairReport['semantic'] => {
  const emojis = extractEmojiSequence(pair);
  if (!emojis.length) return 'other';
  const affection = emojis.filter(e => LOVE_EMOJIS.has(e)).length;
  const humor = emojis.filter(e => LAUGH_EMOJIS.has(e)).length;
  const celebration = emojis.filter(e => CELEBRATION_EMOJIS.has(e)).length;
  if (affection === emojis.length) return 'affection';
  if (humor === emojis.length) return 'humor';
  if (celebration === emojis.length) return 'celebration';
  if (affection || humor || celebration) return 'mixed';
  return 'other';
};

const friendSignalsForMessage = (msg: NormalizedMessage) => {
  if (msg.isMedia) return { support: 0, fun: 0, drama: 0 };
  const laughEmojiBonus = msg.content.match(/[😂🤣😅😁😄😆]/gu)?.length || 0;
  return {
    support: countKeywordHits(msg.content, SUPPORT_KEYWORDS) + msg.signals.thanks + msg.signals.apology,
    fun: countKeywordHits(msg.content, FUN_KEYWORDS) + laughEmojiBonus,
    drama: countKeywordHits(msg.content, FRIEND_DRAMA_KEYWORDS) + msg.adjustedSignals.tension + msg.signals.jealousy + (msg.isShortReply ? 0.3 : 0),
  };
};

const friendTotalsByParticipant = (messages: NormalizedMessage[], authors: string[]) => {
  const totals = Object.fromEntries(authors.map(author => [author, { support: 0, fun: 0, drama: 0, lateNight: 0 }]));
  messages.forEach(msg => {
    const bucket = totals[msg.author];
    if (!bucket) return;
    const signals = friendSignalsForMessage(msg);
    bucket.support += signals.support;
    bucket.fun += signals.fun;
    bucket.drama += signals.drama;
    if (msg.date.getHours() >= 0 && msg.date.getHours() <= 5) bucket.lateNight++;
  });
  return totals;
};

const winnerProfile = (
  title: string,
  a: ParticipantStats,
  b: ParticipantStats,
  personAValue: number,
  personBValue: number,
  description: (winner: ParticipantStats, diffSmall: boolean) => string
): ReportProfile => {
  const winner = personAValue >= personBValue ? a : b;
  const max = Math.max(personAValue, personBValue, 1);
  const min = Math.min(personAValue, personBValue);
  const diffSmall = max > 0 && (max - min) / max < 0.12;
  return {
    title,
    winner: diffSmall ? 'Dengeli' : winner.name,
    score: Math.round(max),
    description: description(winner, diffSmall),
    personAValue,
    personBValue,
  };
};

const periodTitle = (period?: PeriodSummary): string => period ? `${period.key}` : 'veri yok';

const periodDescription = (period?: PeriodSummary, kind = 'dönem'): string => {
  if (!period) return 'Bu bölüm için yeterli dönemsel veri bulunamadı.';
  return `${dateLabel(period.start)} - ${dateLabel(period.end)} aralığında ${period.messageCount.toLocaleString('tr-TR')} mesajla öne çıkan ${kind}.`;
};

const buildFlowStats = (messages: NormalizedMessage[]) => {
  const sessions: number[] = [];
  let start: Date | null = null;
  let end: Date | null = null;

  messages.forEach((msg, index) => {
    const prev = messages[index - 1];
    if (!prev) {
      start = msg.date;
      end = msg.date;
      return;
    }
    const diff = (msg.date.getTime() - prev.date.getTime()) / 60000;
    if (diff <= FLOW_GAP_MINUTES) {
      if (!start) start = prev.date;
      end = msg.date;
    } else {
      if (start && end && end > start) sessions.push((end.getTime() - start.getTime()) / 60000);
      start = msg.date;
      end = msg.date;
    }
  });

  if (start && end && end > start) sessions.push((end.getTime() - start.getTime()) / 60000);
  const total = sessions.reduce((sum, item) => sum + item, 0);
  return {
    totalFlowHours: total / 60,
    longestFlowMinutes: Math.max(...sessions, 0),
    sessionCount: sessions.length,
    averageFlowMinutes: sessions.length ? total / sessions.length : 0,
  };
};

const findLongestSilence = (messages: NormalizedMessage[]) => {
  let result: {
    minutes: number;
    start?: Date;
    end?: Date;
    after?: string;
    brokenBy?: string;
  } = { minutes: 0 };

  messages.forEach((msg, index) => {
    const prev = messages[index - 1];
    if (!prev) return;
    const minutes = (msg.date.getTime() - prev.date.getTime()) / 60000;
    if (minutes > result.minutes) {
      result = {
        minutes,
        start: prev.date,
        end: msg.date,
        after: prev.author,
        brokenBy: msg.author,
      };
    }
  });

  return result;
};

const buildEmojiPairReport = (messages: NormalizedMessage[], authors: string[]): EmojiPairReport[] => {
  const pairs = new Map<string, EmojiPairReport>();

  messages.forEach(msg => {
    if (msg.isMedia) return;
    extractEmojiPairs(msg.content).forEach(pair => {
      if (!pairs.has(pair)) {
        pairs.set(pair, {
          pair,
          count: 0,
          byPerson: Object.fromEntries(authors.map(author => [author, 0])),
          timeline: [],
          semantic: classifyEmojiPair(pair),
        });
      }
      const item = pairs.get(pair)!;
      item.count++;
      item.byPerson[msg.author] = (item.byPerson[msg.author] || 0) + 1;
      const last = item.timeline[item.timeline.length - 1];
      if (last && last.date === msg.dateKey) {
        last.count++;
      } else {
        item.timeline.push({ date: msg.dateKey, count: 1 });
      }
    });
  });

  return [...pairs.values()]
    .filter(item => item.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
};

const isWarmReturnEvidence = (pattern: BehavioralPattern): boolean =>
  pattern.counterEvidence.some(ev => /sıcak|telafi|onarım|dönüş|açıklama|sevgi|plan/i.test(ev.text));

const isReliablePattern = (pattern: BehavioralPattern): boolean => {
  if (pattern.confidence < 0.68) return false;
  if (pattern.evidence.length < 2) return false;
  if (pattern.occurrenceCount < 3 && pattern.id !== 'reciprocity_decline') return false;
  if (isWarmReturnEvidence(pattern) && pattern.confidence < 0.78) return false;
  return true;
};

const buildReportPatterns = (patterns: BehavioralPattern[]): BehavioralPattern[] =>
  patterns
    .filter(isReliablePattern)
    .map(pattern => ({
      ...pattern,
      label: pattern.label
        .replace(/Sessiz tedavi/giu, 'Uzun sessizlik')
        .replace(/Karşılıklılık çöküşü/giu, 'Karşılıklılık değişimi'),
      description: pattern.description
        .replace(/sessiz tedavi/giu, 'uzun sessizlik')
        .replace(/cevap vermemiş/giu, 'uzun süre yanıt gelmemiş')
        .replace(/çöküş/giu, 'değişim')
        .replace(/gaslighting|manipülatif|toxic|toksik/giu, 'gözlenen örüntü'),
    }))
    .sort((a, b) => (b.confidence + b.severity) - (a.confidence + a.severity))
    .slice(0, 5);

const buildCalendar = (analysis: AnalysisResult, personA: string, personB: string, mode: RelationshipMode): CalendarDayReport[] => {
  const byDate = new Map<string, NormalizedMessage[]>();
  analysis.normalizedMessages.forEach(msg => {
    if (!byDate.has(msg.dateKey)) byDate.set(msg.dateKey, []);
    byDate.get(msg.dateKey)!.push(msg);
  });
  const insightsByDate = new Map<string, NonNullable<AnalysisResult['messageInsights']>>();
  (analysis.messageInsights || []).forEach(insight => {
    if (!insightsByDate.has(insight.dateKey)) insightsByDate.set(insight.dateKey, []);
    insightsByDate.get(insight.dateKey)!.push(insight);
  });

  return analysis.dailyStats.map(day => {
    const messages = byDate.get(day.date) || [];
    const insights = insightsByDate.get(day.date) || [];
    const emojiCounts = new Map<string, number>();
    const emojiPairCounts = new Map<string, number>();
    const loveWordCounts = new Map<string, number>();
    const ritualCounts = new Map<string, number>();
    const hourly = new Map<number, { hour: number; total: number; personA: number; personB: number; warmth: number; tension: number }>();
    let loveScore = 0;
    let chaosScore = 0;
    let mediaCount = 0;
    let emojiCount = 0;
    let shortReplyClusters = 0;
    let currentShortRun = 0;
    let planSignals = 0;
    let repairSignals = 0;

    messages.forEach(msg => {
      if (mode === 'friend') {
        const friend = friendSignalsForMessage(msg);
        loveScore += friend.support + friend.fun;
        chaosScore += friend.drama;
      } else {
        loveScore += msg.adjustedSignals.love + msg.signals.emotional + msg.signals.thanks;
        chaosScore += msg.adjustedSignals.tension + msg.adjustedSignals.harsh + msg.signals.jealousy + (msg.isShortReply ? 0.25 : 0);
      }
      mediaCount += msg.isMedia ? 1 : 0;
      emojiCount += msg.emojiCount;
      extractEmojiPairs(msg.content).forEach(pair => emojiPairCounts.set(pair, (emojiPairCounts.get(pair) || 0) + 1));
      if (msg.isShortReply) {
        currentShortRun++;
        if (currentShortRun === 3) shortReplyClusters++;
      } else {
        currentShortRun = 0;
      }
      planSignals += msg.signals.planning + msg.signals.future;
      analysis.loveWordStats.forEach(word => {
        if (!msg.isMedia && msg.content.toLocaleLowerCase('tr-TR').includes(word.word.toLocaleLowerCase('tr-TR'))) {
          loveWordCounts.set(word.word, (loveWordCounts.get(word.word) || 0) + 1);
        }
      });
    });

    analysis.emojiAnalysis.forEach(emoji => {
      const count = emoji.timeline.find(t => t.date === day.date)?.count || 0;
      if (count) emojiCounts.set(emoji.char, count);
    });

    insights.forEach(insight => {
      const hour = new Date(insight.timestamp).getHours();
      if (!hourly.has(hour)) hourly.set(hour, { hour, total: 0, personA: 0, personB: 0, warmth: 0, tension: 0 });
      const h = hourly.get(hour)!;
      h.total++;
      if (insight.speaker === personA) h.personA++;
      if (insight.speaker === personB) h.personB++;
      h.warmth += insight.warmthScore + insight.repairScore;
      h.tension += insight.conflictScore + insight.controlScore + insight.avoidanceScore * 0.5;
      if ((insight as any).modifiers?.ritualKind) {
        const kind = (insight as any).modifiers.ritualKind as string;
        ritualCounts.set(kind, (ritualCounts.get(kind) || 0) + 1);
      }
      if (insight.repairScore > 0.7) repairSignals++;
    });

    const topEmojis = Array.from(emojiCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([emoji, count]) => ({ emoji, count }));
    const topEmojiPairs = Array.from(emojiPairCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([pair, count]) => ({ pair, count }));
    const topLoveWords = Array.from(loveWordCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([word, count]) => ({ word, count }));
    const leader = (day.breakdown[personA] || 0) >= (day.breakdown[personB] || 0) ? personA : personB;
    const hourlyFlow = [...hourly.values()].sort((a, b) => a.hour - b.hour);
    const busiestHour = [...hourlyFlow].sort((a, b) => b.total - a.total)[0]?.hour;
    const warmestHour = [...hourlyFlow].filter(h => h.warmth > 0).sort((a, b) => b.warmth - a.warmth)[0]?.hour;
    const tensestHour = [...hourlyFlow].filter(h => h.tension > 0).sort((a, b) => b.tension - a.tension)[0]?.hour;
    const evidence = insights
      .filter(ins => ins.warmthScore + ins.repairScore + ins.conflictScore + ins.controlScore > 1)
      .sort((a, b) =>
        (b.warmthScore + b.repairScore + b.conflictScore + b.controlScore) -
        (a.warmthScore + a.repairScore + a.conflictScore + a.controlScore)
      )
      .slice(0, 3)
      .map(ins => ({
        messageId: ins.messageId,
        timestamp: ins.timestamp,
        speaker: ins.speaker,
        quoteMasked: ins.textMasked,
        reason: ins.repairScore > 0.7 ? 'onarım sinyali' : ins.warmthScore > ins.conflictScore ? 'sıcaklık sinyali' : 'yoğun konuşma sinyali',
      }));
    const counterEvidence = insights
      .filter(ins => ins.repairScore > 0.7 || (ins.warmthScore > 1 && ins.conflictScore > 0))
      .slice(0, 2)
      .map(ins => ({
        messageId: ins.messageId,
        timestamp: ins.timestamp,
        speaker: ins.speaker,
        quoteMasked: ins.textMasked,
        reason: 'dengeleyici sinyal',
      }));
    const rituals = Array.from(ritualCounts.entries()).sort((a, b) => b[1] - a[1]).map(([kind, count]) => ({ kind, count }));

    const flowHint = busiestHour !== undefined ? ` En canlı saat ${String(busiestHour).padStart(2, '0')}:00 civarı.` : '';
    const pairHint = topEmojiPairs[0] ? ` Öne çıkan emoji çifti ${topEmojiPairs[0].pair}.` : '';
    const clusterHint = shortReplyClusters > 0 && repairSignals > 0
      ? ' Kısa cevap kümeleri var ama sonrasında onarım/sıcak dönüş de görünüyor.'
      : shortReplyClusters > 0
        ? ' Kısa cevap kümeleri tek başına kopuş değil; sadece ritim daralması olarak işaretlendi.'
        : '';

    return {
      date: day.date,
      total: day.total,
      personA: day.breakdown[personA] || 0,
      personB: day.breakdown[personB] || 0,
      loveScore,
      chaosScore,
      mediaCount,
      emojiCount,
      topEmojis,
      topEmojiPairs,
      topLoveWords,
      hourlyFlow,
      busiestHour,
      warmestHour,
      tensestHour,
      rituals,
      evidence,
      counterEvidence,
      shortReplyClusters,
      planSignals,
      repairSignals,
      insight: mode === 'friend'
        ? `${leader} o gün sohbette biraz daha görünür. Vibe/destek skoru ${Math.round(loveScore)}, drama skoru ${Math.round(chaosScore)}.${flowHint}${pairHint}${clusterHint}`
        : `${leader} o gün sohbet trafiğinde biraz daha görünür. Sevgi skoru ${Math.round(loveScore)}, gerilim skoru ${Math.round(chaosScore)}.${flowHint}${pairHint}${clusterHint}`,
    };
  });
};

const buildMonthlyIntensity = (analysis: AnalysisResult, personA: string, personB: string, mode: RelationshipMode): MonthlyIntensityPoint[] => {
  const monthlyMessages = new Map<string, NormalizedMessage[]>();
  analysis.normalizedMessages.forEach(msg => {
    if (!monthlyMessages.has(msg.monthKey)) monthlyMessages.set(msg.monthKey, []);
    monthlyMessages.get(msg.monthKey)!.push(msg);
  });

  return Array.from(monthlyMessages.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, messages]) => {
    let personACount = 0;
    let personBCount = 0;
    let love = 0;
    let chaos = 0;
    messages.forEach(msg => {
      if (msg.author === personA) personACount++;
      if (msg.author === personB) personBCount++;
      if (mode === 'friend') {
        const friend = friendSignalsForMessage(msg);
        love += friend.support + friend.fun;
        chaos += friend.drama;
      } else {
        love += msg.adjustedSignals.love + msg.signals.emotional + msg.signals.thanks;
        chaos += msg.adjustedSignals.tension + msg.adjustedSignals.harsh + msg.signals.jealousy + (msg.isShortReply ? 0.25 : 0);
      }
    });
    return { key, messages: messages.length, personA: personACount, personB: personBCount, love, chaos };
  });
};

const buildTemplateSummary = (analysis: AnalysisResult, personA: ParticipantStats, personB: ParticipantStats, mode: RelationshipMode): string => {
  const total = analysis.totalMessages.toLocaleString('tr-TR');
  const leader = personA.messageCount >= personB.messageCount ? personA : personB;
  if (mode === 'friend') {
    const friendTotals = friendTotalsByParticipant(analysis.normalizedMessages, [personA.name, personB.name]);
    const support = friendTotals[personA.name].support + friendTotals[personB.name].support;
    const fun = friendTotals[personA.name].fun + friendTotals[personB.name].fun;
    const drama = friendTotals[personA.name].drama + friendTotals[personB.name].drama;
    const tone = support + fun >= drama ? 'destekli ve eğlenceli' : 'yakın ama arada drama yükselten';
    return `Bu arkadaşlık ${total} mesajlık ${tone} bir kanka ritmi gösteriyor. ${leader.name} sohbet hacminde daha görünür; destek, iç şaka, gece konuşması ve drama sinyalleri romantik ölçülerden ayrı değerlendirildi. Bu rapor arkadaşlık dinamiğini okur; aşk skoru gibi yorumlanmamalı.`;
  }
  const loveTotal = analysis.nlpSignals.totals.loveAdjusted + analysis.nlpSignals.totals.emotional + analysis.nlpSignals.totals.thanks;
  const tensionTotal = analysis.nlpSignals.totals.tensionAdjusted + analysis.nlpSignals.totals.harshAdjusted + analysis.nlpSignals.totals.jealousy;
  const tone = loveTotal >= tensionTotal ? 'sıcak ve hareketli' : 'iniş çıkışları görünür ama okunabilir';
  return `Bu sohbet ${total} mesajlık ${tone} bir iletişim ritmi gösteriyor. ${leader.name} mesaj hacminde biraz daha görünürken, soru, emoji ve cevap ritmi birlikte bakıldığında tablo tek bir kişiye yüklenmeyen dengeli sinyaller veriyor.`;
};

export const buildRelationshipReport = (analysis: AnalysisResult, mode: RelationshipMode = 'lover'): RelationshipReport => {
  const personA = analysis.participants[0];
  const personB = analysis.participants[1] ?? analysis.participants[0];
  const totalWords = analysis.participants.reduce((sum, person) => sum + person.wordCount, 0);
  const activeDays = analysis.dailyStats.filter(day => day.total > 0).length;
  const longestSilence = findLongestSilence(analysis.normalizedMessages);
  const sweetestPeriod = analysis.periodSummaries.filter(p => p.type === 'week').sort((a, b) => b.loveScore - a.loveScore)[0];
  const chaoticPeriod = analysis.periodSummaries.filter(p => p.type === 'week').sort((a, b) => b.tensionScore - a.tensionScore)[0];
  const quietestPeriod = analysis.periodSummaries.filter(p => p.type === 'week').sort((a, b) => a.messageCount - b.messageCount)[0];
  const busiestDay = [...analysis.dailyStats].sort((a, b) => b.total - a.total)[0];
  const flow = buildFlowStats(analysis.normalizedMessages);
  const calendar = buildCalendar(analysis, personA.name, personB.name, mode);
  const monthlyIntensity = buildMonthlyIntensity(analysis, personA.name, personB.name, mode);
  const dailyMessages = analysis.dailyStats.map(day => ({
    date: day.date,
    total: day.total,
    personA: day.breakdown[personA.name] || 0,
    personB: day.breakdown[personB.name] || 0,
  }));
  const totalEmojiA = Object.values(personA.emojis).reduce((sum, count) => sum + count, 0);
  const totalEmojiB = Object.values(personB.emojis).reduce((sum, count) => sum + count, 0);
  const totalMedia = personA.mediaCount + personB.mediaCount;
  const responseA = personA.avgResponseTimeMinutes;
  const responseB = personB.avgResponseTimeMinutes;
  const friendTotals = friendTotalsByParticipant(analysis.normalizedMessages, [personA.name, personB.name]);
  const friendA = friendTotals[personA.name];
  const friendB = friendTotals[personB.name];
  const emojiPairs = buildEmojiPairReport(analysis.normalizedMessages, [personA.name, personB.name]);
  const reportPatterns = buildReportPatterns(analysis.patterns || []);

  const toPersonStats = (person: ParticipantStats, emojiCount: number): PersonReportStats => ({
    name: person.name,
    messageCount: person.messageCount,
    wordCount: person.wordCount,
    mediaCount: person.mediaCount,
    emojiCount,
    questionCount: person.questionCount,
    questionRate: safePct(person.questionCount, person.messageCount),
    loveSignalCount: person.loveWordsScore + person.emotionalCount + person.thanksCount,
    loveSignalRate: safePct(person.loveWordsScore + person.emotionalCount + person.thanksCount, person.messageCount),
    conversationStarts: person.initiations,
    averageResponseTime: person.avgResponseTimeMinutes,
    medianResponseTime: person.medianResponseTimeMinutes,
    averageMessageLength: person.messageCount ? Math.round((person.wordCount / person.messageCount) * 10) / 10 : 0,
  });

  const topHour = [...analysis.hourlyActivity].sort((a, b) => b.count - a.count)[0];
  const funFact = topHour
    ? `En canlı saat ${String(topHour.hour).padStart(2, '0')}:00 civarı; bu saatte ${topHour.count.toLocaleString('tr-TR')} mesaj birikmiş.`
    : 'Saat yoğunluğu için yeterli veri bulunamadı.';

  const safeEvidence = analysis.algorithmicSummary.evidence
    .filter(item => item.text.length < 120 && !/telefon|adres|email|link|\[telefon\]|\[email\]|\[link\]/i.test(item.text))
    .slice(0, 2);

  return {
    couple: {
      personAName: personA.name,
      personBName: personB.name,
    },
    overview: {
      totalMessages: analysis.totalMessages,
      totalWords,
      dateRange: analysis.dateRange,
      activeDays,
      averageMessagesPerDay: activeDays ? Math.round(analysis.totalMessages / activeDays) : 0,
      analysisDate: new Date(),
      aiSummary: buildTemplateSummary(analysis, personA, personB, mode),
    },
    people: {
      personA: toPersonStats(personA, totalEmojiA),
      personB: toPersonStats(personB, totalEmojiB),
    },
    profiles: {
      emotional: mode === 'friend'
        ? winnerProfile('Destekçi', personA, personB, friendA.support, friendB.support, (winner, diffSmall) =>
          diffSmall ? 'Destek verme sinyalleri iki tarafta da yakın; tek taraflı terapist modu görünmüyor.' : `${winner.name} dinleme, sakinleştirme ve yanında durma sinyallerinde daha görünür.`
        )
        : winnerProfile('Duygusal', personA, personB, personA.loveWordsScore + personA.emotionalCount + totalEmojiA * 0.2, personB.loveWordsScore + personB.emotionalCount + totalEmojiB * 0.2, (winner, diffSmall) =>
          diffSmall ? 'Sevgi ve duygu sinyalleri iki tarafta da yakın görünüyor.' : `${winner.name} sevgi kelimeleri, duygu ifadeleri ve emoji sinyallerinde biraz daha öne çıkıyor.`
      ),
      curious: mode === 'friend'
        ? winnerProfile('Eğlenceli', personA, personB, friendA.fun + totalEmojiA * 0.15, friendB.fun + totalEmojiB * 0.15, (winner, diffSmall) =>
          diffSmall ? 'Mizah ve iç şaka enerjisi dengeli; ikiniz de sohbeti hafifletiyorsunuz.' : `${winner.name} iç şaka, gülme ve kanka dili sinyallerinde daha baskın.`
        )
        : winnerProfile('Meraklı', personA, personB, personA.questionCount, personB.questionCount, (winner, diffSmall) =>
          diffSmall ? 'Soru sorma dengesi oldukça yakın; merak tek tarafa yığılmamış.' : `${winner.name} daha çok soru sorarak sohbeti açan ve detay isteyen taraf gibi görünüyor.`
      ),
      interested: mode === 'friend'
        ? winnerProfile('Planlayıcı', personA, personB, personA.planningCount + personA.futureCount + personA.initiations * 0.5, personB.planningCount + personB.futureCount + personB.initiations * 0.5, (winner, diffSmall) =>
          diffSmall ? 'Plan yapma ve konuşmayı başlatma tarafı dengeli görünüyor.' : `${winner.name} plan yapma, buluşma organize etme ve sohbeti açma tarafında daha aktif.`
        )
        : winnerProfile('İlgili', personA, personB, personA.messageCount + personA.initiations * 8 + personA.wordCount / 20, personB.messageCount + personB.initiations * 8 + personB.wordCount / 20, (winner, diffSmall) =>
          diffSmall ? 'İlgi göstergeleri iki tarafta da yakın; hacim ve başlatma dengesi çok ayrışmıyor.' : `${winner.name} mesaj hacmi, kelime sayısı ve konuşma başlatma sinyallerinde daha görünür.`
      ),
    },
    privacy: {
      rawChatSentToLLM: false,
      anonymizedPayload: true,
      note: 'Tüm yorumlar cihazında üretildi; sohbetin hiçbir kısmı üçüncü taraf bir servise gönderilmedi.',
    },
    deepAnalysis: {
      questions: {
        label: 'Sorular',
        value: analysis.nlpSignals.totals.questions,
        score: safePct(analysis.nlpSignals.totals.questions, analysis.totalMessages),
        description: `${personA.name}: ${personA.questionCount}, ${personB.name}: ${personB.questionCount}. Merak ve iletişim açıklığı sinyali.`,
      },
      shortReplies: {
        label: 'Kısa cevap',
        value: analysis.nlpSignals.totals.shortReplies,
        score: safePct(analysis.nlpSignals.totals.shortReplies, analysis.totalMessages),
        description: 'Tamam, ok, aynen gibi kısa kapanışların yoğunluğunu gösterir.',
      },
      plans: {
        label: 'Plan',
        value: analysis.nlpSignals.totals.planning + analysis.nlpSignals.totals.future,
        score: safePct(analysis.nlpSignals.totals.planning + analysis.nlpSignals.totals.future, analysis.totalMessages),
        description: 'Buluşma, saat, gün ve birlikte aktivite sinyallerini toplar.',
      },
      signals: {
        label: mode === 'friend' ? 'Destek/Vibe' : 'Sinyal',
        value: mode === 'friend'
          ? Math.round(friendA.support + friendB.support + friendA.fun + friendB.fun)
          : analysis.nlpSignals.totals.loveAdjusted + analysis.nlpSignals.totals.emotional + analysis.nlpSignals.totals.thanks,
        score: mode === 'friend'
          ? safePct(friendA.support + friendB.support + friendA.fun + friendB.fun, analysis.totalMessages)
          : safePct(analysis.nlpSignals.totals.loveAdjusted + analysis.nlpSignals.totals.emotional + analysis.nlpSignals.totals.thanks, analysis.totalMessages),
        description: mode === 'friend'
          ? 'Destek, iç şaka, gülme ve kanka dili sinyallerinden oluşur.'
          : 'Sevgi, ilgi, özlem, teşekkür ve pozitif duygu ifadelerinden oluşur.',
      },
      tension: {
        label: mode === 'friend' ? 'Drama' : 'Gerilim',
        value: mode === 'friend'
          ? Math.round(friendA.drama + friendB.drama)
          : analysis.nlpSignals.totals.tensionAdjusted + analysis.nlpSignals.totals.harshAdjusted + analysis.nlpSignals.totals.jealousy,
        score: mode === 'friend'
          ? safePct(friendA.drama + friendB.drama, analysis.totalMessages)
          : safePct(analysis.nlpSignals.totals.tensionAdjusted + analysis.nlpSignals.totals.harshAdjusted + analysis.nlpSignals.totals.jealousy, analysis.totalMessages),
        description: mode === 'friend'
          ? 'Küslük, iptal, soğukluk, görüldü ve kısa cevap gibi arkadaşlık draması sinyallerini toplar.'
          : 'Kıskançlık, sert dil ve gerilim sinyallerini suçlayıcı olmayan biçimde özetler.',
      },
    },
    timeline: {
      mostActiveDay: busiestDay ? {
        date: busiestDay.date,
        title: 'En yoğun gün',
        description: `${busiestDay.total.toLocaleString('tr-TR')} mesajla sohbetin en kalabalık günü.`,
        value: busiestDay.total,
        icon: '◷',
      } : undefined,
      longestSilence: longestSilence.end ? {
        date: longestSilence.end.toISOString(),
        title: 'En uzun sessizlik',
        description: `${formatMinutes(longestSilence.minutes)} boşluktan sonra sohbeti ${longestSilence.brokenBy} yeniden açmış.`,
        value: formatMinutes(longestSilence.minutes),
        icon: '☾',
      } : undefined,
      chaoticPeriod: chaoticPeriod ? {
        date: chaoticPeriod.start,
        title: mode === 'friend' ? 'En drama dönem' : 'En kaotik dönem',
        description: periodDescription(chaoticPeriod, mode === 'friend' ? 'drama dönemi' : 'gerilim dönemi'),
        value: chaoticPeriod.tensionScore,
        icon: '⚡',
      } : undefined,
      sweetestPeriod: sweetestPeriod ? {
        date: sweetestPeriod.start,
        title: mode === 'friend' ? 'En iyi vibe dönemi' : 'En tatlı dönem',
        description: periodDescription(sweetestPeriod, mode === 'friend' ? 'bestie vibe dönemi' : 'tatlı dönem'),
        value: sweetestPeriod.loveScore,
        icon: '♡',
      } : undefined,
    },
    charts: {
      dailyMessages,
      monthlyIntensity,
      hourlyActivity: analysis.hourlyActivity,
      responseSpeedDistribution: analysis.responseTimeBuckets,
    },
    loveDictionary: analysis.loveWordStats,
    scoreCards: {
      sweetest: sweetestPeriod ? {
        label: mode === 'friend' ? 'En İyi Vibe' : 'En Tatlı Dönem',
        value: sweetestPeriod.loveScore,
        score: sweetestPeriod.loveScore,
        description: `${periodTitle(sweetestPeriod)} · ${periodDescription(sweetestPeriod, mode === 'friend' ? 'destek/eğlence dönemi' : 'sevgi dönemi')}`,
      } : undefined,
      chaotic: chaoticPeriod ? {
        label: mode === 'friend' ? 'En Drama Dönem' : 'En Kaotik Dönem',
        value: chaoticPeriod.tensionScore,
        score: chaoticPeriod.tensionScore,
        description: `${periodTitle(chaoticPeriod)} · ${periodDescription(chaoticPeriod, mode === 'friend' ? 'drama dönemi' : 'kaos dönemi')}`,
      } : undefined,
      quietest: quietestPeriod ? {
        label: 'En Sessiz Dönem',
        value: quietestPeriod.messageCount,
        score: quietestPeriod.messageCount,
        description: `${periodTitle(quietestPeriod)} · ${quietestPeriod.messageCount.toLocaleString('tr-TR')} mesajla en sakin hafta.`,
      } : undefined,
    },
    media: {
      personA: personA.mediaCount,
      personB: personB.mediaCount,
      total: totalMedia,
      rate: safePct(totalMedia, analysis.totalMessages),
    },
    flow,
    calendar,
    emoji: {
      topOverall: analysis.emojiAnalysis.slice(0, 12).map(item => ({
        emoji: item.char,
        count: item.count,
        byPerson: item.byParticipant,
        timeline: item.timeline,
      })),
      byPerson: {
        [personA.name]: Object.entries(personA.emojis).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([emoji, count]) => ({ emoji, count })),
        [personB.name]: Object.entries(personB.emojis).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([emoji, count]) => ({ emoji, count })),
      },
      topPairs: emojiPairs,
      loveEmojiCount: analysis.emojiAnalysis.filter(item => LOVE_EMOJIS.has(item.char)).reduce((sum, item) => sum + item.count, 0),
      laughEmojiCount: analysis.emojiAnalysis.filter(item => LAUGH_EMOJIS.has(item.char)).reduce((sum, item) => sum + item.count, 0),
    },
    patterns: reportPatterns,
    narratives: {
      loveLanguage: mode === 'friend'
        ? `${personA.name} destek ${Math.round(friendA.support)}, eğlence ${Math.round(friendA.fun)}; ${personB.name} destek ${Math.round(friendB.support)}, eğlence ${Math.round(friendB.fun)} sinyali üretmiş. Arkadaşlık dili burada romantik sevgi yerine destek, iç şaka ve birlikte plan yapma üzerinden okunur.`
        : `${personA.name} tarafında ${personA.loveWordsScore} sevgi kelimesi ve ${personA.planningCount} plan sinyali, ${personB.name} tarafında ${personB.loveWordsScore} sevgi kelimesi ve ${personB.planningCount} plan sinyali görünüyor. Bu tablo onaylayıcı sözler, şefkat ve kaliteli zaman başlıklarını birlikte düşündürüyor.`,
      communicationBalance: mode === 'friend'
        ? `${personA.name} ${personA.messageCount.toLocaleString('tr-TR')} mesaj / ${personA.initiations} başlangıç, ${personB.name} ${personB.messageCount.toLocaleString('tr-TR')} mesaj / ${personB.initiations} başlangıç üretmiş. Arkadaşlıkta bu denge ilgi değil; kim daha çok tea açıyor, kim toparlıyor, kim planlıyor diye okunmalı.`
        : `${personA.name} ${personA.messageCount.toLocaleString('tr-TR')} mesaj / ${personA.initiations} başlangıç, ${personB.name} ${personB.messageCount.toLocaleString('tr-TR')} mesaj / ${personB.initiations} başlangıç üretmiş. Bu farklar ilgi eksikliği değil, sohbeti başlatma ve genişletme ritmi olarak okunmalı.`,
      responseRhythm: `${personA.name} ortalama ${formatMinutes(responseA)}, medyan ${formatMinutes(personA.medianResponseTimeMinutes)}; ${personB.name} ortalama ${formatMinutes(responseB)}, medyan ${formatMinutes(personB.medianResponseTimeMinutes)} cevap ritmine sahip. Medyanın düşük olması çoğu cevabın hızlı, ortalamanın yüksek olması ise birkaç uzun bekleyişin etkili olduğunu gösterebilir.`,
      evidenceBasedFun: safeEvidence.length
        ? safeEvidence.map(item => `${item.participantAlias}: “${item.text}”`).join(' · ')
        : 'Bu bölüm için güvenli ve kısa örnek bulunamadı.',
      shortNote: mode === 'friend'
        ? 'Bu arkadaşlık analizi yalnızca WhatsApp sohbet ritmine dayalı eğlenceli bir yorumlamadır. Gerçek dostluğunuzun tamamını yansıtmaz ve terapötik değerlendirme değildir.'
        : 'Bu analiz yalnızca sohbet verilerine dayalı eğlenceli bir yorumlamadır. Gerçek ilişkinizin tüm karmaşıklığını yansıtmaz ve psikolojik/terapötik değerlendirme değildir.',
      funFact,
    },
  };
};
