import {
  AnalysisResult,
  ChatSegment,
  DailyStats,
  EmojiUsage,
  EvidenceSnippet,
  FlowStats,
  HourlyActivity,
  LlmCompactSummary,
  LoveWordStat,
  Message,
  NlpSignals,
  NormalizedMessage,
  ParticipantStats,
  PeriodSummary,
  RelationshipMilestone,
  ResponseTimeBucket
} from '../types';
import {
  buildKeywordRegex,
  hasLaugh,
  hasNegation,
  matchKeywordCount,
  splitClauses
} from './turkishLemma';
import { detectPatterns } from './patternDetectors';

type SignalKey = keyof NormalizedMessage['signals'];
type ProgressCallback = (stage: string) => void;

const SESSION_GAP_MINUTES = 360;
const FLUENT_GAP_MINUTES = 3;
const LONG_SILENCE_MINUTES = 24 * 60;
const MAX_LLM_PAYLOAD_CHARS = 18000;

const LOVE_KEYWORDS = ['aşkım', 'sevgilim', 'bitanem', 'hayatım', 'seni seviyorum', 'özledim', 'canım', 'bebeğim', 'balım', 'kalbim', 'çiçeğim', 'kuzum', 'yavrum', 'prensesim', 'paşam', 'aşk', 'her şeyim'];
const EMOTIONAL_KEYWORDS = ['mutlu', 'üzgün', 'kırıldım', 'sevindim', 'ağladım', 'hissediyorum', 'özledim', 'yalnız', 'heyecan', 'kalbim', 'iyi geldi'];
const APOLOGY_KEYWORDS = ['özür', 'pardon', 'kusura bakma', 'affet', 'hata yaptım'];
const THANKS_KEYWORDS = ['teşekkür', 'sağ ol', 'sağol', 'minnettar'];
const PLANNING_KEYWORDS = ['buluşalım', 'gidelim', 'yapalım', 'plan', 'rezervasyon', 'yarın', 'hafta sonu', 'akşam', 'saat kaç'];
const FUTURE_KEYWORDS = ['olacak', 'yapacağız', 'görüşürüz', 'gideceğiz', 'gelecek', 'ileride', 'bir gün'];
const JEALOUSY_KEYWORDS = ['kıskandım', 'kıskanç', 'kim o', 'nerdesin', 'neredesin', 'kiminle', 'neden yazdı'];
const TENSION_KEYWORDS = ['trip', 'kavga', 'tartış', 'sinir', 'bıktım', 'yeter', 'umursamıyorsun', 'anlamıyorsun', 'soğuk', 'problem', 'sorun'];
const HARSH_KEYWORDS = ['aptal', 'salak', 'mal', 'nefret', 'sus', 'defol', 'siktir', 'lanet', 'yalancı'];

const LOVE_REGEX = buildKeywordRegex(LOVE_KEYWORDS);
const EMOTIONAL_REGEX = buildKeywordRegex(EMOTIONAL_KEYWORDS);
const APOLOGY_REGEX = buildKeywordRegex(APOLOGY_KEYWORDS);
const THANKS_REGEX = buildKeywordRegex(THANKS_KEYWORDS);
const PLANNING_REGEX = buildKeywordRegex(PLANNING_KEYWORDS);
const FUTURE_REGEX = buildKeywordRegex(FUTURE_KEYWORDS);
const JEALOUSY_REGEX = buildKeywordRegex(JEALOUSY_KEYWORDS);
const TENSION_REGEX = buildKeywordRegex(TENSION_KEYWORDS);
const HARSH_REGEX = buildKeywordRegex(HARSH_KEYWORDS);

const isEmoji = (segment: string): boolean => {
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;
  return emojiRegex.test(segment) && isNaN(Number(segment)) && segment !== '*' && segment !== '#';
};

const getGraphemes = (text: string): string[] => {
  const IntlAny = Intl as any;
  if (typeof IntlAny !== 'undefined' && 'Segmenter' in IntlAny) {
    const segmenter = new IntlAny.Segmenter('tr', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text)).map((s: any) => s.segment);
  }
  return Array.from(text);
};

const pad = (value: number) => String(value).padStart(2, '0');

export const getDateKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const getMonthKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const getWeekKey = (date: Date): string => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${pad(week)}`;
};

const emptySignals = (): NormalizedMessage['signals'] => ({
  love: 0,
  emotional: 0,
  apology: 0,
  thanks: 0,
  planning: 0,
  future: 0,
  jealousy: 0,
  tension: 0,
  harsh: 0
});

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const truncate = (text: string, max = 150): string => {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
};

export const anonymizeText = (text: string, _aliasMap: Record<string, string> = {}): string => {
  // Kişi adları gerçek isimleriyle korunur (kullanıcı tercihi). Yalnızca link,
  // e-posta, telefon ve uzun sayı dizileri maskelenir.
  const clean = text
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[email]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[telefon]')
    .replace(/\b\d{4,}\b/g, '[sayı]');

  return truncate(clean);
};

const getDominantSignals = (messages: NormalizedMessage[]): string[] => {
  const totals: Record<SignalKey, number> = {
    love: 0,
    emotional: 0,
    apology: 0,
    thanks: 0,
    planning: 0,
    future: 0,
    jealousy: 0,
    tension: 0,
    harsh: 0
  };

  messages.forEach(msg => {
    (Object.keys(totals) as SignalKey[]).forEach(key => {
      totals[key] += msg.signals[key];
    });
  });

  return Object.entries(totals)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => key);
};

const summarizePeriod = (key: string, type: 'week' | 'month', messages: NormalizedMessage[], authors: string[]): PeriodSummary => {
  const participantCounts: Record<string, number> = {};
  authors.forEach(author => participantCounts[author] = 0);

  let loveScore = 0;
  let tensionScore = 0;
  let questionScore = 0;
  let planningScore = 0;

  messages.forEach(msg => {
    participantCounts[msg.author] = (participantCounts[msg.author] || 0) + 1;
    loveScore += msg.signals.love + msg.signals.emotional + msg.signals.thanks;
    tensionScore += msg.signals.tension + msg.signals.jealousy + msg.signals.harsh;
    questionScore += msg.hasQuestion ? 1 : 0;
    planningScore += msg.signals.planning + msg.signals.future;
  });

  const dominantParticipant = Object.entries(participantCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || authors[0] || 'Bilinmiyor';
  const dominantSignals = getDominantSignals(messages);
  const rhythm = messages.length > 500 ? 'çok yoğun' : messages.length > 150 ? 'hareketli' : messages.length > 40 ? 'sakin ama düzenli' : 'sessiz';
  const shortSummary = `${rhythm} dönem; öne çıkan sinyaller: ${dominantSignals.join(', ') || 'denge'}.`;

  return {
    key,
    type,
    start: getDateKey(messages[0].date),
    end: getDateKey(messages[messages.length - 1].date),
    messageCount: messages.length,
    dominantParticipant,
    loveScore,
    tensionScore,
    questionScore,
    planningScore,
    shortSummary
  };
};

const createEmptyParticipantStats = (name: string): ParticipantStats => ({
  name,
  messageCount: 0,
  wordCount: 0,
  charCount: 0,
  mediaCount: 0,
  avgResponseTimeMinutes: 0,
  medianResponseTimeMinutes: 0,
  initiations: 0,
  emojis: {},
  topEmojis: [],
  loveWordsScore: 0,
  questionCount: 0,
  shortReplyCount: 0,
  apologyCount: 0,
  thanksCount: 0,
  planningCount: 0,
  futureCount: 0,
  jealousyCount: 0,
  tensionCount: 0,
  harshCount: 0,
  emotionalCount: 0,
  ghostingCount: 0
});

const normalizeMessages = (messages: Message[]): NormalizedMessage[] => {
  const sorted = messages.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
  const result: NormalizedMessage[] = [];

  sorted.forEach((msg, id) => {
    const content = msg.content.trim();
    const lowerContent = content.toLowerCase();
    const words = msg.isMedia ? [] : content.split(/\s+/).filter(Boolean);
    const signals = emptySignals();
    const clauses = msg.isMedia ? [] : splitClauses(content);

    // Cümle/clause bazlı sayım: bir clause'da pozitif, başka clause'da negatif
    // varsa ham sayımları ayrı tut, negasyon kararı clause-bazında uygulanır.
    const clauseFlags = clauses.map(c => ({
      lower: c.toLowerCase(),
      negation: hasNegation(c)
    }));

    if (msg.isMedia) {
      // medya mesajları için sayım yok
    } else if (clauseFlags.length === 0) {
      signals.love = matchKeywordCount(lowerContent, LOVE_REGEX);
      signals.emotional = matchKeywordCount(lowerContent, EMOTIONAL_REGEX);
      signals.apology = matchKeywordCount(lowerContent, APOLOGY_REGEX);
      signals.thanks = matchKeywordCount(lowerContent, THANKS_REGEX);
      signals.planning = matchKeywordCount(lowerContent, PLANNING_REGEX);
      signals.future = matchKeywordCount(lowerContent, FUTURE_REGEX);
      signals.jealousy = matchKeywordCount(lowerContent, JEALOUSY_REGEX);
      signals.tension = matchKeywordCount(lowerContent, TENSION_REGEX);
      signals.harsh = matchKeywordCount(lowerContent, HARSH_REGEX);
    } else {
      clauseFlags.forEach(({ lower }) => {
        signals.love += matchKeywordCount(lower, LOVE_REGEX);
        signals.emotional += matchKeywordCount(lower, EMOTIONAL_REGEX);
        signals.apology += matchKeywordCount(lower, APOLOGY_REGEX);
        signals.thanks += matchKeywordCount(lower, THANKS_REGEX);
        signals.planning += matchKeywordCount(lower, PLANNING_REGEX);
        signals.future += matchKeywordCount(lower, FUTURE_REGEX);
        signals.jealousy += matchKeywordCount(lower, JEALOUSY_REGEX);
        signals.tension += matchKeywordCount(lower, TENSION_REGEX);
        signals.harsh += matchKeywordCount(lower, HARSH_REGEX);
      });
    }

    const negationFlag = clauseFlags.some(f => f.negation);
    const selfLaugh = !msg.isMedia && hasLaugh(content);
    const previousLaugh = result.length > 0 ? result[result.length - 1].playfulnessFlag : false;
    const playfulnessFlag = selfLaugh || previousLaugh;

    const adjustedSignals = {
      love: negationFlag ? 0 : signals.love,
      emotional: signals.emotional,
      tension: playfulnessFlag ? 0 : signals.tension,
      harsh: playfulnessFlag || negationFlag ? 0 : signals.harsh
    };

    result.push({
      ...msg,
      id,
      content,
      dateKey: getDateKey(msg.date),
      weekKey: getWeekKey(msg.date),
      monthKey: getMonthKey(msg.date),
      wordCount: words.length,
      charCount: msg.isMedia ? 0 : content.length,
      emojiCount: msg.isMedia ? 0 : getGraphemes(content).filter(isEmoji).length,
      hasQuestion: /\?|\b(mi|mı|mu|mü|neden|niye|nasıl|ne zaman|kim|nerede|nerdesin)\b/i.test(content),
      hasExclamation: content.includes('!'),
      hasUrl: /https?:\/\/|www\./i.test(content),
      isShortReply: !msg.isMedia && words.length > 0 && words.length <= 3 && content.length <= 25,
      // Sonraki mesajda komşuluk damper'i için bu mesajın gülme durumunu
      // saklıyoruz; mevcut mesajın playful'luğu kendi gülmesi VEYA önceki
      // mesajın gülmesi ile belirleniyor — playfulnessFlag bunu yansıtır.
      clauses,
      playfulnessFlag: selfLaugh,
      negationFlag,
      signals,
      adjustedSignals
    });
  });

  // İkinci geçiş: komşuluk (önceki mesaj gülüyorsa) damper'ini uygula.
  // Birinci geçişte playfulnessFlag yalnızca self-laugh'a göre yazıldı; burada
  // bir önceki mesajın gülmesini de hesaba katıp adjusted'ı yeniden hesaplıyor
  // ve playfulnessFlag'i nihai değerine güncelliyoruz.
  for (let i = 0; i < result.length; i++) {
    const self = result[i].playfulnessFlag;
    const prevLaugh = i > 0 ? !!result[i - 1].playfulnessFlag : false;
    const finalPlayful = self || prevLaugh;
    if (finalPlayful !== self) {
      const m = result[i];
      m.playfulnessFlag = finalPlayful;
      m.adjustedSignals = {
        love: m.negationFlag ? 0 : m.signals.love,
        emotional: m.signals.emotional,
        tension: finalPlayful ? 0 : m.signals.tension,
        harsh: finalPlayful || m.negationFlag ? 0 : m.signals.harsh
      };
    }
  }

  return result;
};

const groupBy = <T,>(items: T[], getKey: (item: T) => string): Record<string, T[]> => {
  const map: Record<string, T[]> = {};
  items.forEach(item => {
    const key = getKey(item);
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return map;
};

const buildSegments = (messages: NormalizedMessage[], authors: string[], aliasMap: Record<string, string>): ChatSegment[] => {
  const sessionSegments: ChatSegment[] = [];
  let current: NormalizedMessage[] = [];

  const flushSession = () => {
    if (!current.length) return;
    const participants: Record<string, number> = {};
    authors.forEach(author => participants[author] = 0);
    current.forEach(msg => participants[msg.author] = (participants[msg.author] || 0) + 1);

    sessionSegments.push({
      id: `session-${sessionSegments.length + 1}`,
      type: 'session',
      start: current[0].date,
      end: current[current.length - 1].date,
      messageCount: current.length,
      participants,
      dominantSignals: getDominantSignals(current),
      sampleEvidence: current
        .filter(msg => !msg.isMedia && (msg.signals.love || msg.signals.tension || msg.signals.planning || msg.hasQuestion))
        .slice(0, 3)
        .map(msg => `${aliasMap[msg.author]}: ${anonymizeText(msg.content, aliasMap)}`)
    });
  };

  messages.forEach((msg, index) => {
    const prev = messages[index - 1];
    const diffMinutes = prev ? (msg.date.getTime() - prev.date.getTime()) / 60000 : 0;
    if (prev && diffMinutes > SESSION_GAP_MINUTES) {
      flushSession();
      current = [];
    }
    current.push(msg);
  });
  flushSession();

  return sessionSegments;
};

const buildPeriodSummaries = (messages: NormalizedMessage[], authors: string[]): PeriodSummary[] => {
  const weekly = Object.entries(groupBy(messages, msg => msg.weekKey))
    .map(([key, items]) => summarizePeriod(key, 'week', items, authors));
  const monthly = Object.entries(groupBy(messages, msg => msg.monthKey))
    .map(([key, items]) => summarizePeriod(key, 'month', items, authors));

  return [...monthly, ...weekly].sort((a, b) => a.start.localeCompare(b.start));
};

const buildMilestones = (dailyStats: DailyStats[], periodSummaries: PeriodSummary[], normalized: NormalizedMessage[]): RelationshipMilestone[] => {
  const milestones: RelationshipMilestone[] = [];
  const busiest = [...dailyStats].sort((a, b) => b.total - a.total)[0];
  const sweetest = [...periodSummaries].filter(p => p.type === 'week').sort((a, b) => b.loveScore - a.loveScore)[0];
  const tense = [...periodSummaries].filter(p => p.type === 'week').sort((a, b) => b.tensionScore - a.tensionScore)[0];

  if (busiest) {
    milestones.push({
      date: busiest.date,
      label: 'En yoğun gün',
      description: `${busiest.total.toLocaleString()} mesajla sohbetin en kalabalık günü.`,
      intensity: busiest.total
    });
  }

  if (sweetest && sweetest.loveScore > 0) {
    milestones.push({
      date: sweetest.start,
      label: 'En tatlı dönem',
      description: `${sweetest.key} sevgi, duygu ve teşekkür sinyallerinin en çok yükseldiği dönem.`,
      intensity: sweetest.loveScore
    });
  }

  if (tense && tense.tensionScore > 0) {
    milestones.push({
      date: tense.start,
      label: 'En kaotik dönem',
      description: `${tense.key} gerilim, kıskançlık veya sert dil sinyallerinin en görünür olduğu dönem.`,
      intensity: tense.tensionScore
    });
  }

  let longestGap = { minutes: 0, date: '' };
  normalized.forEach((msg, index) => {
    const prev = normalized[index - 1];
    if (!prev) return;
    const diff = (msg.date.getTime() - prev.date.getTime()) / 60000;
    if (diff > longestGap.minutes) {
      longestGap = { minutes: diff, date: getDateKey(msg.date) };
    }
  });

  if (longestGap.minutes >= LONG_SILENCE_MINUTES) {
    milestones.push({
      date: longestGap.date,
      label: 'En uzun sessizlik',
      description: `Yaklaşık ${Math.round(longestGap.minutes / 60)} saatlik boşluktan sonra sohbet yeniden başlamış.`,
      intensity: longestGap.minutes
    });
  }

  return milestones.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
};

const buildEvidence = (messages: NormalizedMessage[], aliasMap: Record<string, string>): EvidenceSnippet[] => {
  const categories: Array<{ key: string; predicate: (msg: NormalizedMessage) => boolean }> = [
    { key: 'sevgi dili', predicate: msg => msg.signals.love > 0 || msg.signals.emotional > 0 },
    { key: 'merak ve soru', predicate: msg => msg.hasQuestion },
    { key: 'plan yapma', predicate: msg => msg.signals.planning > 0 || msg.signals.future > 0 },
    { key: 'gerilim sinyali', predicate: msg => msg.signals.tension > 0 || msg.signals.jealousy > 0 || msg.signals.harsh > 0 },
    { key: 'minnet ve onarım', predicate: msg => msg.signals.thanks > 0 || msg.signals.apology > 0 }
  ];

  const evidence: EvidenceSnippet[] = [];

  categories.forEach(category => {
    const matches = messages.filter(msg => !msg.isMedia && category.predicate(msg));
    if (!matches.length) return;

    const picks = [
      matches[0],
      matches[Math.floor(matches.length / 2)],
      matches[matches.length - 1]
    ];

    Array.from(new Set(picks.map(msg => msg.id)))
      .map(id => messages[id])
      .filter(Boolean)
      .slice(0, 2)
      .forEach(msg => {
        evidence.push({
          category: category.key,
          date: msg.dateKey,
          participantAlias: aliasMap[msg.author],
          text: anonymizeText(msg.content, aliasMap)
        });
      });
  });

  return evidence.slice(0, 16);
};

const createCompactSummary = (
  participants: ParticipantStats[],
  nlpSignals: NlpSignals,
  periodSummaries: PeriodSummary[],
  milestones: RelationshipMilestone[],
  evidence: EvidenceSnippet[],
  totalMessages: number,
  dateRange: { start: Date; end: Date },
  aliasMap: Record<string, string>
): LlmCompactSummary => {
  const compact: LlmCompactSummary = {
    privacyNote: 'Ham sohbet LLM payloadına dahil edilmedi; sadece sıkıştırılmış metrikler ve kısa kanıt parçaları gönderildi. Kişi adları kullanıcının tercihiyle korundu; link/e-posta/telefon/uzun sayı dizileri maskelendi.',
    aliases: { ...aliasMap },
    totalMessages,
    dateRange: {
      start: getDateKey(dateRange.start),
      end: getDateKey(dateRange.end)
    },
    participantSummaries: participants.map(participant => ({
      alias: aliasMap[participant.name],
      messageCount: participant.messageCount,
      wordCount: participant.wordCount,
      avgResponseMinutes: Number(participant.avgResponseTimeMinutes.toFixed(1)),
      medianResponseMinutes: Number(participant.medianResponseTimeMinutes.toFixed(1)),
      initiations: participant.initiations,
      questionRate: Number((nlpSignals.byParticipant[participant.name]?.questionRate || 0).toFixed(3)),
      loveRate: Number((nlpSignals.byParticipant[participant.name]?.loveRate || 0).toFixed(3)),
      tensionRate: Number((nlpSignals.byParticipant[participant.name]?.tensionRate || 0).toFixed(3)),
      harshRate: Number((nlpSignals.byParticipant[participant.name]?.harshRate || 0).toFixed(3)),
      topEmojis: participant.topEmojis
    })),
    periodHighlights: periodSummaries
      .filter(period => period.type === 'month')
      .sort((a, b) => (b.messageCount + b.loveScore + b.tensionScore) - (a.messageCount + a.loveScore + a.tensionScore))
      .slice(0, 10)
      .map(period => ({
        ...period,
        dominantParticipant: aliasMap[period.dominantParticipant] || period.dominantParticipant
      })),
    milestones,
    evidence,
    payloadStats: {
      approximateChars: 0,
      sourcePolicy: 'compact-summary-only'
    }
  };

  let serialized = JSON.stringify(compact);
  while (serialized.length > MAX_LLM_PAYLOAD_CHARS && compact.evidence.length > 4) {
    compact.evidence.pop();
    serialized = JSON.stringify(compact);
  }
  compact.payloadStats.approximateChars = serialized.length;

  return compact;
};

export const analyzeChat = (messages: Message[], onProgress?: ProgressCallback): AnalysisResult => {
  if (messages.length === 0) {
    throw new Error('Mesaj bulunamadı.');
  }

  onProgress?.('Mesajlar normalize ediliyor');
  let normalizedMessages = normalizeMessages(messages);
  const authorCounts = normalizedMessages.reduce<Record<string, number>>((acc, msg) => {
    acc[msg.author] = (acc[msg.author] || 0) + 1;
    return acc;
  }, {});
  const authors = Object.entries(authorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([author]) => author);
  normalizedMessages = normalizedMessages.filter(msg => authors.includes(msg.author));
  if (normalizedMessages.length < 2 || authors.length < 1) {
    throw new Error('Ana katılımcılar tespit edilemedi.');
  }
  // Kişi adları olduğu gibi kullanılır; "Kişi A / Kişi B" gibi anonim
  // takma adlar üretilmez. aliasMap identity map olarak korunur, böylece
  // mevcut çağrı yerlerinin imzası bozulmaz.
  const aliasMap = Object.fromEntries(authors.map(author => [author, author]));

  onProgress?.('Temel metrikler hesaplanıyor');
  const statsMap: Record<string, ParticipantStats> = {};
  authors.forEach(name => {
    statsMap[name] = createEmptyParticipantStats(name);
  });

  const responseTimes: Record<string, number[]> = {};
  authors.forEach(a => responseTimes[a] = []);

  const responseBuckets: Record<string, Record<string, number>> = {
    'Hızlı (<1dk)': {},
    'Normal (1-5dk)': {},
    'Sakin (5-15dk)': {},
    'Yavaş (15dk+)': {}
  };
  Object.keys(responseBuckets).forEach(key => authors.forEach(a => responseBuckets[key][a] = 0));

  const hourlyCounts = new Array(24).fill(0);
  const dailyMap: Record<string, DailyStats> = {};
  const emojiGlobalStats: Record<string, EmojiUsage> = {};
  const loveWordStatsMap: Record<string, LoveWordStat> = {};
  LOVE_KEYWORDS.forEach(word => {
    loveWordStatsMap[word] = { word, count: 0, byParticipant: {} };
    authors.forEach(author => loveWordStatsMap[word].byParticipant[author] = 0);
  });

  const fluentSessions: number[] = [];
  let currentSessionStart: Date | null = null;
  let currentSessionEnd: Date | null = null;

  normalizedMessages.forEach((msg, index) => {
    const stat = statsMap[msg.author];
    if (!stat) return;

    stat.messageCount++;
    stat.mediaCount += msg.isMedia ? 1 : 0;
    stat.charCount += msg.charCount;
    stat.wordCount += msg.wordCount;
    stat.loveWordsScore += msg.signals.love;
    stat.questionCount += msg.hasQuestion ? 1 : 0;
    stat.shortReplyCount += msg.isShortReply ? 1 : 0;
    stat.apologyCount += msg.signals.apology;
    stat.thanksCount += msg.signals.thanks;
    stat.planningCount += msg.signals.planning;
    stat.futureCount += msg.signals.future;
    stat.jealousyCount += msg.signals.jealousy;
    stat.tensionCount += msg.signals.tension;
    stat.harshCount += msg.signals.harsh;
    stat.emotionalCount += msg.signals.emotional;

    hourlyCounts[msg.date.getHours()]++;

    if (!dailyMap[msg.dateKey]) {
      dailyMap[msg.dateKey] = { date: msg.dateKey, total: 0, breakdown: {} };
      authors.forEach(author => dailyMap[msg.dateKey].breakdown[author] = 0);
    }
    dailyMap[msg.dateKey].total++;
    dailyMap[msg.dateKey].breakdown[msg.author]++;

    if (!msg.isMedia) {
      getGraphemes(msg.content).forEach(char => {
        if (!isEmoji(char)) return;
        stat.emojis[char] = (stat.emojis[char] || 0) + 1;
        if (!emojiGlobalStats[char]) {
          emojiGlobalStats[char] = { char, count: 0, byParticipant: {}, timeline: [] };
          authors.forEach(author => emojiGlobalStats[char].byParticipant[author] = 0);
        }
        emojiGlobalStats[char].count++;
        emojiGlobalStats[char].byParticipant[msg.author]++;
        const lastEntry = emojiGlobalStats[char].timeline[emojiGlobalStats[char].timeline.length - 1];
        if (lastEntry && lastEntry.date === msg.dateKey) {
          lastEntry.count++;
        } else {
          emojiGlobalStats[char].timeline.push({ date: msg.dateKey, count: 1 });
        }
      });
    }

    const lowerContent = msg.content.toLowerCase();
    LOVE_KEYWORDS.forEach(word => {
      if (lowerContent.includes(word)) {
        loveWordStatsMap[word].count++;
        loveWordStatsMap[word].byParticipant[msg.author]++;
      }
    });

    const previous = normalizedMessages[index - 1];
    if (!previous) {
      stat.initiations++;
      return;
    }

    const diffMinutes = (msg.date.getTime() - previous.date.getTime()) / 60000;

    if (msg.author !== previous.author && diffMinutes >= 0) {
      responseTimes[msg.author].push(diffMinutes);
      if (diffMinutes < 1) responseBuckets['Hızlı (<1dk)'][msg.author]++;
      else if (diffMinutes < 5) responseBuckets['Normal (1-5dk)'][msg.author]++;
      else if (diffMinutes < 15) responseBuckets['Sakin (5-15dk)'][msg.author]++;
      else responseBuckets['Yavaş (15dk+)'][msg.author]++;
    }

    if (diffMinutes > SESSION_GAP_MINUTES) {
      stat.initiations++;
    }

    if (diffMinutes > LONG_SILENCE_MINUTES) {
      stat.ghostingCount++;
    }

    if (diffMinutes <= FLUENT_GAP_MINUTES) {
      if (!currentSessionStart) currentSessionStart = previous.date;
      currentSessionEnd = msg.date;
    } else {
      if (currentSessionStart && currentSessionEnd) {
        const sessionDuration = (currentSessionEnd.getTime() - currentSessionStart.getTime()) / 60000;
        if (sessionDuration > 0) fluentSessions.push(sessionDuration);
      }
      currentSessionStart = null;
      currentSessionEnd = null;
    }
  });

  if (currentSessionStart && currentSessionEnd) {
    const sessionDuration = (currentSessionEnd.getTime() - currentSessionStart.getTime()) / 60000;
    if (sessionDuration > 0) fluentSessions.push(sessionDuration);
  }

  Object.values(statsMap).forEach(stat => {
    const times = responseTimes[stat.name];
    const totalTime = times.reduce((a, b) => a + b, 0);
    stat.avgResponseTimeMinutes = times.length ? totalTime / times.length : 0;
    stat.medianResponseTimeMinutes = median(times);
    stat.topEmojis = Object.entries(stat.emojis)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([emoji]) => emoji);
  });

  onProgress?.('Dönemler ve oturumlar çıkarılıyor');
  const dailyStats: DailyStats[] = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  const segments = buildSegments(normalizedMessages, authors, aliasMap);
  const periodSummaries = buildPeriodSummaries(normalizedMessages, authors);

  onProgress?.('NLP sinyalleri hesaplanıyor');
  const totals = normalizedMessages.reduce<NlpSignals['totals']>((acc, msg) => {
    acc.questions += msg.hasQuestion ? 1 : 0;
    acc.exclamations += msg.hasExclamation ? 1 : 0;
    acc.shortReplies += msg.isShortReply ? 1 : 0;
    acc.urls += msg.hasUrl ? 1 : 0;
    acc.love += msg.signals.love;
    acc.emotional += msg.signals.emotional;
    acc.apology += msg.signals.apology;
    acc.thanks += msg.signals.thanks;
    acc.planning += msg.signals.planning;
    acc.future += msg.signals.future;
    acc.jealousy += msg.signals.jealousy;
    acc.tension += msg.signals.tension;
    acc.harsh += msg.signals.harsh;
    acc.loveAdjusted += msg.adjustedSignals.love;
    acc.tensionAdjusted += msg.adjustedSignals.tension;
    acc.harshAdjusted += msg.adjustedSignals.harsh;
    acc.playfulMessages += msg.playfulnessFlag ? 1 : 0;
    acc.negatedMessages += msg.negationFlag ? 1 : 0;
    return acc;
  }, {
    questions: 0,
    exclamations: 0,
    shortReplies: 0,
    urls: 0,
    love: 0,
    emotional: 0,
    apology: 0,
    thanks: 0,
    planning: 0,
    future: 0,
    jealousy: 0,
    tension: 0,
    harsh: 0,
    loveAdjusted: 0,
    tensionAdjusted: 0,
    harshAdjusted: 0,
    playfulMessages: 0,
    negatedMessages: 0,
    longSilences: Object.values(statsMap).reduce((total, stat) => total + stat.ghostingCount, 0)
  });

  const nlpSignals: NlpSignals = {
    totals,
    byParticipant: Object.fromEntries(authors.map(author => {
      const stat = statsMap[author];
      const divisor = stat.messageCount || 1;
      return [author, {
        questionRate: stat.questionCount / divisor,
        initiationRate: stat.initiations / divisor,
        shortReplyRate: stat.shortReplyCount / divisor,
        loveRate: stat.loveWordsScore / divisor,
        tensionRate: (stat.tensionCount + stat.jealousyCount) / divisor,
        harshRate: stat.harshCount / divisor,
        planningRate: (stat.planningCount + stat.futureCount) / divisor,
        medianResponseMinutes: stat.medianResponseTimeMinutes
      }];
    }))
  };

  const flowStats: FlowStats = {
    totalFluentMinutes: fluentSessions.reduce((a, b) => a + b, 0),
    maxFluentSessionMinutes: Math.max(...fluentSessions, 0),
    averageDailyFluentMinutes: fluentSessions.reduce((a, b) => a + b, 0) / (dailyStats.length || 1)
  };

  const hourlyActivity: HourlyActivity[] = hourlyCounts.map((count, hour) => ({ hour, count }));
  const emojiAnalysis: EmojiUsage[] = Object.values(emojiGlobalStats).sort((a, b) => b.count - a.count);
  const loveWordStats = Object.values(loveWordStatsMap).filter(w => w.count > 0).sort((a, b) => b.count - a.count);
  const responseTimeBuckets: ResponseTimeBucket[] = Object.entries(responseBuckets).map(([range, counts]) => ({ range, counts }));

  onProgress?.('Davranış örüntüleri taranıyor');
  const patterns = detectPatterns(normalizedMessages, authors, dailyStats, periodSummaries);

  onProgress?.('Yapay zeka için güvenli özet hazırlanıyor');
  const milestones = buildMilestones(dailyStats, periodSummaries, normalizedMessages);
  const evidence = buildEvidence(normalizedMessages, aliasMap);
  const participants = Object.values(statsMap);
  const dateRange = {
    start: normalizedMessages[0].date,
    end: normalizedMessages[normalizedMessages.length - 1].date
  };
  const llmSummary = createCompactSummary(
    participants,
    nlpSignals,
    periodSummaries,
    milestones,
    evidence,
    normalizedMessages.length,
    dateRange,
    aliasMap
  );

  const sampleConversation = evidence.map(item => `${item.participantAlias}: ${item.text}`).join('\n');

  return {
    participants,
    totalMessages: normalizedMessages.length,
    dateRange,
    flow: flowStats,
    hourlyActivity,
    dailyStats,
    emojiAnalysis,
    loveWordStats,
    responseTimeBuckets,
    rawMessages: normalizedMessages,
    normalizedMessages,
    segments,
    periodSummaries,
    nlpSignals,
    milestones,
    patterns,
    llmSummary,
    sampleConversation
  };
};

// Dev-mode kendi kendini doğrulama: temel sarkazm/negasyon/word-boundary
// senaryolarının regrese etmediğini hızla yakalamak için. Sadece beklenmeyen
// sonuç olduğunda console.warn basar.
if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
  const fixtures: Array<{ author: string; date: Date; content: string; isMedia?: boolean }> = [
    { author: 'Ali', date: new Date(2025, 0, 1, 10, 0), content: 'Aptal mısın? 😂' },
    { author: 'Ayşe', date: new Date(2025, 0, 1, 10, 1), content: 'seni sevmiyorum' },
    { author: 'Ali', date: new Date(2025, 0, 1, 10, 2), content: 'seni çok seviyorum aşkım' },
    { author: 'Ayşe', date: new Date(2025, 0, 1, 10, 3), content: 'malum durum' },
    { author: 'Ali', date: new Date(2025, 0, 1, 10, 4), content: 'salak değilsin' },
    { author: 'Ayşe', date: new Date(2025, 0, 1, 10, 5), content: 'of nefret ediyorum bu hayattan' }
  ];
  const norm = normalizeMessages(fixtures.map(f => ({ ...f, isMedia: !!f.isMedia })));
  const expectations: Array<[string, boolean]> = [
    ['"Aptal mısın? 😂" harshAdjusted=0', norm[0].adjustedSignals.harsh === 0 && norm[0].signals.harsh >= 1],
    ['"seni sevmiyorum" loveAdjusted=0', norm[1].adjustedSignals.love === 0 && norm[1].negationFlag === true],
    ['"seni çok seviyorum aşkım" love≥1', norm[2].signals.love >= 1 && norm[2].adjustedSignals.love >= 1],
    ['"malum durum" harsh=0 (substring sızıntısı yok)', norm[3].signals.harsh === 0],
    ['"salak değilsin" harshAdjusted=0', norm[4].adjustedSignals.harsh === 0 && norm[4].negationFlag === true],
    ['"of nefret ediyorum…" harsh≥1', norm[5].signals.harsh >= 1 && norm[5].adjustedSignals.harsh >= 1]
  ];
  const failed = expectations.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) {
    // eslint-disable-next-line no-console
    console.warn('[analytics self-check] başarısız beklentiler:', failed, norm);
  }
}
