// services/nlp/types.ts — services/nlp katmanının dahili tipleri.
// types.ts (repo kökü) zaten MessageInsight, RelationshipEpisode,
// RelationshipPattern, ConversationStyleProfile içeriyor; burada onları
// reuse + classifier-spesifik tipler eklenir.

import type {
  EvidenceItem,
  MessageInsight,
  NormalizedMessage,
} from '../../types';

// Bir runtime classifier'ın ürettiği etiket. annotation pipeline ile bilinçli
// olarak benzer ama tip seviyesinde bağımsızdır.
export type ClassifierTag =
  | 'affection'
  | 'warm_ack'
  | 'neutral_ack'
  | 'cold_ack'
  | 'humor_playful'
  | 'sarcasm_possible'
  | 'passive_aggressive_possible'
  | 'withdrawal_possible'
  | 'conflict_shutdown'
  | 'topic_shift'
  | 'apology'
  | 'repair_attempt'
  | 'criticism'
  | 'harsh_language'
  | 'invalidation'
  | 'reality_denial'
  | 'blame_shift'
  | 'responsibility_reversal'
  | 'control_pressure'
  | 'jealousy_check'
  | 'care_checkin'
  | 'neutral_question'
  | 'boundary_setting'
  | 'plan_cancel'
  | 'real_laugh'
  | 'softener_laugh'
  | 'awkward_laugh'
  | 'defensive_laugh'
  | 'sarcastic_laugh'
  | 'flirty_laugh'
  // PR-4 (couple-dialect):
  | 'emoji_cluster'
  | 'ritual_message'
  | 'intensified_endearment'
  | 'intensified_filler'
  | 'echo_warmth'
  | 'inside_joke_pattern'
  | 'ambiguous'
  | 'none';

export type EvidenceSource =
  | 'rule'
  | 'learned_pattern'
  | 'context'
  | 'style_profile'
  | 'emoji'
  | 'punctuation'
  // PR-4: ritual saat eşleşmesi & emoji cluster kanıt kategorileri.
  | 'time'
  | 'cluster';

export interface ClassifierEvidence {
  span: string;
  reason: string;
  source: EvidenceSource;
}

export interface ClassifierResult {
  tag: ClassifierTag;
  confidence: number;
  evidence: ClassifierEvidence[];
  counterEvidence: ClassifierEvidence[];
  modifiers?: Record<string, boolean | number>;
}

export interface ContextWindow {
  prev: NormalizedMessage[];      // önceki N mesaj (eski→yeni)
  target: NormalizedMessage;
  next: NormalizedMessage[];      // sonraki M mesaj
  index: number;                  // tüm pencerelerdeki global index
  gapBeforeMinutes: number | null;
  gapAfterMinutes: number | null;
}

export interface EnrichedInsight extends MessageInsight {
  classifierTags: ClassifierResult[];
  confidenceOverall: number;
  evidence: EvidenceItem[];
  counterEvidence: EvidenceItem[];
  modifiers: {
    negated: boolean;
    negationClauseScoped: boolean;
    playful: boolean;
    sarcasm: boolean;
    laughKind?: 'real' | 'softener' | 'awkward' | 'defensive' | 'sarcastic' | 'flirty';
    // PR-4: couple-dialect modifier'ları (hepsi opsiyonel; geriye-uyumlu).
    emojiCluster?: {
      kind: import('./learned/learnedEmojiClusters').EmojiClusterKind;
      size: number;
      bursting: boolean;
      customAffection: boolean;
      boundWarmTerm?: import('./learned/learnedEmojiTermBindings').AffectionTerm;
    };
    ritualKind?: import('./learned/learnedRitualPhrases').RitualKind;
    timeOfDay?: 'night' | 'morning' | 'day';
    ritualInExpectedWindow?: boolean;
    intensifierDrag?: {
      onWarmTerm: boolean;
      onFiller: boolean;
      maxRepeatLen: number;
    };
    echoLagMessages?: number;
    echoLagMinutes?: number;
  };
  styleAuthorKey?: 'A' | 'B';
  source: EvidenceSource[];
}

export interface BuildInsightsOptions {
  styleProfile?: import('../../types').ConversationStyleProfile;
  relationMode?: 'lover' | 'friend';
  /** Confidence eşiği; bunun altındaki classifierTags görünmez kalır. */
  minVisibleConfidence?: number;
}
