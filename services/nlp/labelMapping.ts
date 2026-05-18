// labelMapping — annotation pipeline ClassifierTag (24+) ↔ types.ts
// RelationshipSignalKey (32) ↔ NormalizedMessage.signals (9-key dar).
// Bu fazda dashboard kırılmasın diye dar 9-key yapısına geri-eşleme
// EKLEMEYİZ; sadece okuma yönünde mapping sağlanır.

import type {
  DialogueAct,
  RelationshipSignalKey,
} from '../../types';
import type { ClassifierTag } from './types';

/** ClassifierTag → RelationshipSignalKey kümesi (genelde 1:1, bazen 1:N) */
export const classifierTagToSignalKeys: Record<ClassifierTag, RelationshipSignalKey[]> = {
  affection: ['affection'],
  warm_ack: ['affection'],
  neutral_ack: [],
  cold_ack: ['withdrawal'],
  humor_playful: ['humor'],
  sarcasm_possible: ['sarcasm'],
  passive_aggressive_possible: ['contempt', 'sarcasm'],
  withdrawal_possible: ['withdrawal'],
  conflict_shutdown: ['stonewalling'],
  topic_shift: ['avoidance'],
  apology: ['apology'],
  repair_attempt: ['repairAttempt'],
  criticism: ['criticism'],
  harsh_language: ['harshLanguage'],
  invalidation: ['manipulationLike'],
  reality_denial: ['manipulationLike'],
  blame_shift: ['blameShifting'],
  responsibility_reversal: ['manipulationLike', 'blameShifting'],
  control_pressure: ['control'],
  jealousy_check: ['jealousy'],
  care_checkin: ['reassurance'],
  neutral_question: [],
  boundary_setting: ['boundarySetting'],
  plan_cancel: ['cancellation'],
  real_laugh: ['humor'],
  softener_laugh: ['humor'],
  awkward_laugh: ['humor'],
  defensive_laugh: ['defensiveness'],
  sarcastic_laugh: ['sarcasm'],
  flirty_laugh: ['humor', 'sexualOrRomanticIntimacy'],
  // PR-4: yeni couple-dialect tag'leri mevcut signal key'lere map'lenir
  // (RelationshipSignalKey'e yeni anahtar eklenmez — dashboard sözleşmesi).
  emoji_cluster:           ['affection'],
  ritual_message:          ['affection'],
  intensified_endearment:  ['affection'],
  intensified_filler:      [],
  echo_warmth:             ['affection', 'repairAttempt'],
  inside_joke_pattern:     ['humor', 'affection'],
  ambiguous: [],
  none: [],
};

/** ClassifierTag → DialogueAct (geçerli olduğunda). */
export const classifierTagToDialogueAct: Partial<Record<ClassifierTag, DialogueAct>> = {
  affection: 'affection',
  warm_ack: 'affection',
  neutral_ack: 'short_ack',
  cold_ack: 'short_ack',
  humor_playful: 'joke',
  sarcasm_possible: 'joke',
  passive_aggressive_possible: 'complaint',
  withdrawal_possible: 'shutdown',
  conflict_shutdown: 'shutdown',
  topic_shift: 'topic_shift',
  apology: 'apology',
  repair_attempt: 'repair_attempt',
  criticism: 'complaint',
  harsh_language: 'accusation',
  invalidation: 'accusation',
  reality_denial: 'defense',
  blame_shift: 'accusation',
  responsibility_reversal: 'accusation',
  control_pressure: 'jealousy_check',
  jealousy_check: 'jealousy_check',
  care_checkin: 'reassurance',
  neutral_question: 'question',
  boundary_setting: 'boundary_setting',
  plan_cancel: 'plan_cancellation',
  real_laugh: 'joke',
  softener_laugh: 'joke',
  awkward_laugh: 'joke',
  defensive_laugh: 'defense',
  sarcastic_laugh: 'joke',
  flirty_laugh: 'flirt',
  // PR-4:
  emoji_cluster:          'affection',
  ritual_message:         'affection',
  intensified_endearment: 'affection',
  echo_warmth:            'reassurance',
  inside_joke_pattern:    'joke',
  // intensified_filler intentionally undefined (no DA contribution)
};

/**
 * RelationshipSignalKey'in 9-key NormalizedMessage.signals'a kabaca eşi.
 * Sadece raporlama amaçlı; runtime davranışı için kullanılmaz (Dashboard
 * mevcut 9-key yapısını analytics.ts üzerinden almaya devam eder).
 */
export const signalKeyToNarrow: Partial<Record<RelationshipSignalKey, keyof import('../../types').NormalizedMessage['signals']>> = {
  affection: 'love',
  longing: 'love',
  emotionalOpenness: 'emotional',
  apology: 'apology',
  reassurance: 'thanks',
  planning: 'planning',
  futureTalk: 'future',
  jealousy: 'jealousy',
  control: 'jealousy',
  harshLanguage: 'harsh',
  criticism: 'tension',
  contempt: 'tension',
  defensiveness: 'tension',
  cancellation: 'planning',
};
