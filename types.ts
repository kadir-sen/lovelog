
export interface Message {
  date: Date;
  author: string;
  content: string;
  isMedia: boolean;
}

export interface NormalizedMessage extends Message {
  id: number;
  dateKey: string;
  weekKey: string;
  monthKey: string;
  wordCount: number;
  charCount: number;
  emojiCount: number;
  hasQuestion: boolean;
  hasExclamation: boolean;
  hasUrl: boolean;
  isShortReply: boolean;
  clauses: string[];
  playfulnessFlag: boolean;
  negationFlag: boolean;
  signals: {
    love: number;
    emotional: number;
    apology: number;
    thanks: number;
    planning: number;
    future: number;
    jealousy: number;
    tension: number;
    harsh: number;
  };
  adjustedSignals: {
    love: number;
    emotional: number;
    tension: number;
    harsh: number;
  };
}

export interface ParticipantStats {
  name: string;
  messageCount: number;
  wordCount: number;
  charCount: number;
  mediaCount: number; // Added media tracking
  avgResponseTimeMinutes: number;
  medianResponseTimeMinutes: number;
  initiations: number; 
  emojis: Record<string, number>;
  topEmojis: string[];
  loveWordsScore: number;
  questionCount: number;
  shortReplyCount: number;
  apologyCount: number;
  thanksCount: number;
  planningCount: number;
  futureCount: number;
  jealousyCount: number;
  tensionCount: number;
  harshCount: number;
  emotionalCount: number;
  ghostingCount: number;
}

export interface FlowStats {
  totalFluentMinutes: number;
  maxFluentSessionMinutes: number;
  averageDailyFluentMinutes: number;
}

export interface HourlyActivity {
  hour: number;
  count: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  total: number;
  breakdown: Record<string, number>; 
}

export interface EmojiUsage {
  char: string;
  count: number;
  byParticipant: Record<string, number>;
  timeline: { date: string; count: number }[]; 
}

// New interface for specific love word breakdown
export interface LoveWordStat {
  word: string;
  count: number;
  byParticipant: Record<string, number>;
}

// New interface for response time buckets
export interface ResponseTimeBucket {
  range: string; // e.g. "< 1 dk", "1-5 dk"
  counts: Record<string, number>; // { "Ali": 50, "Ayşe": 30 }
}

export interface ChatSegment {
  id: string;
  type: 'session' | 'week' | 'month';
  start: Date;
  end: Date;
  messageCount: number;
  participants: Record<string, number>;
  dominantSignals: string[];
  sampleEvidence: string[];
}

export interface PeriodSummary {
  key: string;
  type: 'week' | 'month';
  start: string;
  end: string;
  messageCount: number;
  dominantParticipant: string;
  loveScore: number;
  tensionScore: number;
  questionScore: number;
  planningScore: number;
  shortSummary: string;
}

export interface NlpSignals {
  totals: {
    questions: number;
    exclamations: number;
    shortReplies: number;
    urls: number;
    love: number;
    emotional: number;
    apology: number;
    thanks: number;
    planning: number;
    future: number;
    jealousy: number;
    tension: number;
    harsh: number;
    loveAdjusted: number;
    tensionAdjusted: number;
    harshAdjusted: number;
    playfulMessages: number;
    negatedMessages: number;
    longSilences: number;
  };
  byParticipant: Record<string, {
    questionRate: number;
    initiationRate: number;
    shortReplyRate: number;
    loveRate: number;
    tensionRate: number;
    harshRate: number;
    planningRate: number;
    medianResponseMinutes: number;
  }>;
}

export interface RelationshipMilestone {
  date: string;
  label: string;
  description: string;
  intensity: number;
}

export interface EvidenceSnippet {
  category: string;
  date: string;
  participantAlias: string;
  text: string;
}

export type PatternId =
  | 'stonewalling'
  | 'attack_apology_loop'
  | 'plan_cancellation'
  | 'reciprocity_decline'
  | 'slow_fade'
  | 'hot_cold_cycle'
  | 'breadcrumbing'
  | 'love_bombing_like'
  | 'future_faking_like'
  | 'guilt_tripping_like'
  | 'gaslighting_like'
  | 'control_or_surveillance'
  | 'emotional_labor_imbalance'
  | 'repair_imbalance'
  | 'anxious_avoidant_loop';

export interface PatternEvidence {
  date: string;
  author: string;
  text: string;
  role: 'trigger' | 'response' | 'context';
  messageId: number;
}

export interface BehavioralPattern {
  id: PatternId;
  label: string;
  description: string;
  severity: number;
  confidence: number;
  occurrenceCount: number;
  perpetrator?: string;
  victim?: string;
  dateRange: { start: string; end: string };
  evidence: PatternEvidence[];
  counterEvidence: PatternEvidence[];
}

// Algoritmik özet bağlamı — Gemini'nin yerine yerel template engine kullanır.
// Bu yapı, summaryEngine.ts tarafından üretilen başlıklı paragrafları taşır.
export interface AlgorithmicSummary {
  privacyNote: string;
  aliases: Record<string, string>;
  totalMessages: number;
  dateRange: { start: string; end: string };
  participantSummaries: Array<{
    alias: string;
    messageCount: number;
    wordCount: number;
    avgResponseMinutes: number;
    medianResponseMinutes: number;
    initiations: number;
    questionRate: number;
    loveRate: number;
    tensionRate: number;
    harshRate: number;
    topEmojis: string[];
  }>;
  periodHighlights: PeriodSummary[];
  milestones: RelationshipMilestone[];
  evidence: EvidenceSnippet[];
}

export interface AnalysisResult {
  participants: ParticipantStats[];
  totalMessages: number;
  dateRange: { start: Date; end: Date };
  flow: FlowStats;
  hourlyActivity: HourlyActivity[];
  dailyStats: DailyStats[];
  emojiAnalysis: EmojiUsage[];
  loveWordStats: LoveWordStat[]; // Added
  responseTimeBuckets: ResponseTimeBucket[]; // Added
  rawMessages: Message[];
  normalizedMessages: NormalizedMessage[];
  segments: ChatSegment[];
  periodSummaries: PeriodSummary[];
  nlpSignals: NlpSignals;
  milestones: RelationshipMilestone[];
  patterns: BehavioralPattern[];
  algorithmicSummary: AlgorithmicSummary;
  sampleConversation: string;
  // services/nlp katmanından gelen opsiyonel ek alanlar. Dashboard bu fazda
  // bu alanları okumak zorunda değil; ileride yeni kart/insight için kullanılacak.
  messageInsights?: MessageInsight[];
  episodes?: RelationshipEpisode[];
  relationshipPatterns?: RelationshipPattern[];
  styleProfile?: ConversationStyleProfile;
}

// --- ConversationStyleProfile (services/nlp/styleProfile.ts ile aynı şekil) ---
export interface AuthorStyleProfile {
  avgMessageLength: number;
  shortReplyRate: number;
  topEmojis: string[];
  topLaughPatterns: string[];
  warmTermUsage: string[];
  punctuationStyle: {
    dotEndingRate: number;
    ellipsisRate: number;
    questionRate: number;
    exclamationRate: number;
  };
  baselineTone: {
    playfulRate: number;
    affectionateRate: number;
    conflictRate: number;
    sarcasmCandidateRate: number;
  };
}

export interface ConversationStyleProfile {
  authors: {
    A: AuthorStyleProfile;
    B: AuthorStyleProfile;
  };
  relationshipDialect: {
    warmTerms: string[];
    playfulInsults: string[];
    sarcasmCuePatterns: string[];
    coldAckPatterns: string[];
    careCheckinPatterns: string[];
    controlPressurePatterns: string[];
    laughPatterns: string[];
    emojiSemantics: Record<string, string[]>;
    insideJokeCandidates: string[];
    // PR-9 couple-dialect zenginleştirmesi — hepsi opsiyonel, geriye-uyumlu.
    emojiPairFrequency?: Array<{ pair: string; count: number }>;
    ritualTimeDistribution?: Record<string, { night: number; morning: number; day: number; total: number }>;
    customAffectionEmojis?: string[];
    intensifierDragSamples?: Array<{ base: string; count: number }>;
    authorAffectionLeaning?: {
      A: { dominantEmoji?: string; warmTermTop?: string };
      B: { dominantEmoji?: string; warmTermTop?: string };
    };
  };
}

export type NormalizedSpeaker = 'user' | 'partner' | 'other';

export interface RelationshipMessage {
  id: string;
  speaker: string;
  normalizedSpeaker: NormalizedSpeaker;
  text: string;
  normalizedText: string;
  timestamp: string;
  dateKey: string;
  replyDelayMinutes?: number;
  previousMessageId?: string;
  isShortReply?: boolean;
  hasEmoji?: boolean;
  hasQuestion?: boolean;
  hasMediaPlaceholder?: boolean;
}

export type RelationshipSignalKey =
  | 'affection'
  | 'longing'
  | 'emotionalOpenness'
  | 'reassurance'
  | 'insecurity'
  | 'jealousy'
  | 'control'
  | 'avoidance'
  | 'withdrawal'
  | 'criticism'
  | 'contempt'
  | 'defensiveness'
  | 'stonewalling'
  | 'apology'
  | 'accountability'
  | 'blameShifting'
  | 'repairAttempt'
  | 'planning'
  | 'cancellation'
  | 'futureTalk'
  | 'sexualOrRomanticIntimacy'
  | 'boundarySetting'
  | 'boundaryViolation'
  | 'humor'
  | 'sarcasm'
  | 'harshLanguage'
  | 'manipulationLike'
  | 'friendSupport'
  | 'insideJoke'
  | 'friendCheckIn'
  | 'friendReciprocity'
  | 'friendExclusion'
  | 'friendDrama';

export interface MessageSignalDetail {
  count: number;
  score: number;
  evidenceTerms: string[];
  negated: boolean;
  playfulDampened: boolean;
}

export type MessageSignal = Record<RelationshipSignalKey, MessageSignalDetail>;

export type DialogueAct =
  | 'affection'
  | 'greeting'
  | 'question'
  | 'explanation'
  | 'reassurance'
  | 'reassurance_request'
  | 'complaint'
  | 'accusation'
  | 'defense'
  | 'apology'
  | 'apology_acceptance'
  | 'repair_attempt'
  | 'topic_shift'
  | 'shutdown'
  | 'short_ack'
  | 'plan_invitation'
  | 'plan_confirmation'
  | 'plan_cancellation'
  | 'jealousy_check'
  | 'boundary_setting'
  | 'boundary_violation'
  | 'joke'
  | 'flirt'
  | 'goodbye'
  | 'unknown';

export interface MessageInsight {
  messageId: string;
  speaker: string;
  normalizedSpeaker: NormalizedSpeaker;
  timestamp: string;
  dateKey: string;
  textMasked: string;
  signals: MessageSignal;
  dialogueActs: DialogueAct[];
  emotionalValence: number;
  conflictScore: number;
  warmthScore: number;
  avoidanceScore: number;
  controlScore: number;
  repairScore: number;
  replyDelayMinutes?: number;
  isShortReply?: boolean;
  hasQuestion?: boolean;
}

export interface EvidenceItem {
  messageId: string;
  timestamp: string;
  speaker: string;
  quoteMasked: string;
  reason: string;
}

export interface RelationshipEpisode {
  id: string;
  type:
    | 'conflict'
    | 'repair'
    | 'ghosting_gap'
    | 'slow_fade'
    | 'hot_cold_cycle'
    | 'plan_cancel'
    | 'jealousy_conflict'
    | 'affection_peak'
    | 'withdrawal_period'
    | 'boundary_issue'
    | 'breakup_or_goodbye'
    | 'comeback';
  startTime: string;
  endTime: string;
  participants: string[];
  summary: string;
  dominantSignals: RelationshipSignalKey[];
  severity: number;
  confidence: number;
  evidence: EvidenceItem[];
  counterEvidence: EvidenceItem[];
}

export interface RelationshipPattern {
  type:
    | 'reciprocity_drop'
    | 'stonewalling'
    | 'attack_apology_cycle'
    | 'plan_cancel_pattern'
    | 'hot_cold_cycle'
    | 'slow_fade'
    | 'breadcrumbing'
    | 'love_bombing_like'
    | 'future_faking_like'
    | 'guilt_tripping_like'
    | 'gaslighting_like'
    | 'control_or_surveillance'
    | 'jealousy_spiral'
    | 'emotional_labor_imbalance'
    | 'repair_imbalance'
    | 'anxious_avoidant_loop';
  severity: number;
  confidence: number;
  perpetrator?: string;
  affected?: string;
  summary: string;
  evidence: EvidenceItem[];
  counterEvidence: EvidenceItem[];
  metrics: Record<string, number | string>;
}
