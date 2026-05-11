
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
  occurrenceCount: number;
  perpetrator?: string;
  victim?: string;
  dateRange: { start: string; end: string };
  evidence: PatternEvidence[];
}

export interface LlmCompactSummary {
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
  payloadStats: {
    approximateChars: number;
    sourcePolicy: string;
  };
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
  llmSummary: LlmCompactSummary;
  sampleConversation: string;
  // Coach screen için önceden hesaplanmış ilişki/sinyal profili.
  // analyzeChat sırasında viewerName + relationMode bilindiğinde doldurulur;
  // koç ekranı bu varsa lazy build yapmaz (saniyeler → ms).
  coachProfile?: ConversationProfile;
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

export interface ConversationProfile {
  dateRange: { start: string; end: string };
  totalMessages: number;
  participantStats: Record<string, {
    messageCount: number;
    messageShare: number;
    initiativeCount: number;
    avgReplyDelayMinutes: number;
    affectionRate: number;
    questionRate: number;
    repairRate: number;
    avoidanceRate: number;
  }>;
  relationshipPhases: Array<{ period: string; label: string; dominantSignals: string[]; summary: string }>;
  weeklyTrends: Array<Record<string, number | string>>;
  monthlyTrends: Array<Record<string, number | string>>;
  globalMetrics: {
    reciprocityScore: number;
    initiativeBalance: number;
    affectionConsistency: number;
    conflictIntensity: number;
    conflictRecoverySpeed: number;
    responseLatencyAsymmetry: number;
    repairBalance: number;
    emotionalLaborImbalance: number;
    avoidanceScore: number;
    controlJealousyRisk: number;
    hotColdScore: number;
    ghostingRisk: number;
    oneSidednessScore: number;
  };
  topPatterns: RelationshipPattern[];
  keyEpisodes: RelationshipEpisode[];
  messageInsights: MessageInsight[];
}

export interface CoachQueryPlan {
  intent: string;
  questionType: string;
  targetPerson: 'user' | 'partner' | 'both' | 'unknown';
  timeRange: {
    mode: 'all' | 'recent' | 'specific_date' | 'specific_range' | 'before_after';
    startDate: string | null;
    endDate: string | null;
    days: number | null;
  };
  neededSignals: string[];
  neededPatterns: string[];
  neededEpisodes: string[];
  retrievalStrategy: {
    messageLimit: number;
    includeRecentExamples: boolean;
    includeOldBaseline: boolean;
    includeConflictEpisodes: boolean;
    includeAffectionExamples: boolean;
    includePlanEvents: boolean;
    includeLongSilences: boolean;
    includeCounterEvidence: boolean;
  };
  answerStyle: 'soft' | 'direct' | 'protective' | 'analytical' | 'balanced' | 'decision';
  safetyMode: 'normal' | 'emotional_distress' | 'abuse_risk' | 'self_harm_risk' | 'violence_risk';
  shouldAvoid: string[];
  requiresCounterEvidence: boolean;
  confidence: number;
  isFollowUp?: boolean;
  topicShift?: boolean;
  userClaimedNewEvidence?: boolean;
}

export interface CoachChatTurn {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
}

export interface CoachInsightContext {
  userQuestion: string;
  recentCoachTurns: CoachChatTurn[];
  viewerPerspective: {
    selectedName: string | null;
    selectedRole: NormalizedSpeaker | 'unknown';
  };
  queryFrame: {
    topic: string;
    userFraming: 'positive' | 'negative' | 'ambiguous' | 'request_advice' | 'safety';
    needsProactiveRiskCheck: boolean;
    reason: string;
  };
  plan: CoachQueryPlan;
  conversationOverview: {
    totalMessages: number;
    dateRange: string;
    participants: string[];
  };
  relevantMetrics: Record<string, number | string>;
  relevantTrends: Array<Record<string, number | string>>;
  detectedPatterns: RelationshipPattern[];
  surfacedRisks: Array<{
    type: string;
    severity: number;
    confidence: number;
    whyItMatters: string;
    evidence: EvidenceItem[];
  }>;
  relevantEpisodes: RelationshipEpisode[];
  retrievedMessages: EvidenceItem[];
  counterEvidence: EvidenceItem[];
  safetyNotes: string[];
  answerRules: string[];
}

export interface GeminiInsight {
  summary: string;         // Positive/General summary
  negativeSummary: string; // Dark/Sarcastic summary
  
  // Positive / Love
  mostEmotional: string;
  mostCurious: string;
  mostInterested: string;
  // Negative / Conflict
  mostArgumentative: string; // Kavgacı
  mostUnfair: string;        // Anlayışsız
  mostToxic: string;         // Kırıcı/Kötü söz
  
  funFact: string;
  relationshipTimeline?: string;
  loveLanguageAnalysis?: string;
  communicationBalance?: string;
  responseRhythm?: string;
  tensionAnalysis?: string;
  evidenceBasedFun?: string;
  carefulAdvice?: string;
}
