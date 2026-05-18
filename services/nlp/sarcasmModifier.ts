// sarcasmModifier — pozitif lafız + negatif bağlam vs gerçek warmth vs
// passive_aggressive_possible ayrımı. Tek mesaja bakmaz; ctx kullanır.

import type { ClassifierResult, ContextWindow } from './types';
import { prevConflictLevel, prevPlayLevel, nextRepairOrWarmth } from './contextWindow';
import { learnedSarcasmCues, type SarcasmContextBoost } from './learned/learnedSarcasmCues';
import { sarcasmEmojiRegex, humorEmojiRegex } from './learned/learnedEmojiSemantics';
import { learnedExtendedLaughRegex } from './learned/learnedLaughPatterns';
import { learnedPhraseWeights } from './learned/learnedPhraseWeights';

export type SarcasmTag =
  | 'sarcasm_possible'
  | 'passive_aggressive_possible'
  | 'humor_playful'
  | 'emoji_contradiction'
  | 'positive_literal_but_negative_context'
  | 'none';

export interface SarcasmResult extends ClassifierResult {
  tag: SarcasmTag;
  modifiers: {
    dampensWarmth: boolean;
    intensifierDrag: boolean;
    rollingEyes: boolean;
  };
}

const INTENSIFIER_DRAG_REGEX = /\b\w*([a-zçğıöşü])\1{2,}\w*\b/iu;

const evaluateBoosts = (boosts: SarcasmContextBoost[], ctx: ContextWindow, text: string): number => {
  let bonus = 0;
  for (const b of boosts) {
    if (b === 'previous_conflict' && prevConflictLevel(ctx) >= 1) bonus += 0.15;
    if (b === 'rolling_eyes' && sarcasmEmojiRegex.test(text)) bonus += 0.2;
    if (b === 'cold_punctuation' && /\.$/.test(text.trim())) bonus += 0.05;
    if (b === 'intensifier_drag' && INTENSIFIER_DRAG_REGEX.test(text)) bonus += learnedPhraseWeights.intensifierDragBoost;
    if (b === 'next_silence' && (ctx.gapAfterMinutes ?? 0) > 60) bonus += 0.05;
  }
  return bonus;
};

const evd = (
  span: string,
  reason: string,
  source: 'rule' | 'learned_pattern' | 'context' | 'emoji' | 'punctuation'
) => ({ span, reason, source });

export const detectSarcasm = (ctx: ContextWindow): SarcasmResult => {
  const m = ctx.target;
  const text = m.content || '';
  if (!text) return base('none', 0);

  const conflict = prevConflictLevel(ctx);
  const play = prevPlayLevel(ctx);
  const rollingEyes = sarcasmEmojiRegex.test(text);
  const intensifierDrag = INTENSIFIER_DRAG_REGEX.test(text);
  const humorEmoji = humorEmojiRegex.test(text);
  const extendedLaugh = learnedExtendedLaughRegex.test(text);
  const repairAfter = nextRepairOrWarmth(ctx);

  // 1) Lexicon eşleşmesi var mı?
  let bestConfidence = 0;
  let bestEvidence: ReturnType<typeof evd>[] = [];
  let matchedCueLabel: string | null = null;

  for (const cue of learnedSarcasmCues) {
    if (!cue.pattern.test(text)) continue;
    let conf = cue.defaultConfidence;
    if (cue.requiresContext) {
      const bonus = evaluateBoosts(cue.contextBoosts, ctx, text);
      conf = bonus > 0 ? conf + bonus : conf - 0.15; // context yoksa düşür
    }
    if (conf > bestConfidence) {
      bestConfidence = conf;
      bestEvidence = [evd(cue.label, 'sarcasm cue eşleşti', 'learned_pattern')];
      matchedCueLabel = cue.label;
    }
  }

  bestConfidence = Math.min(1, Math.max(0, bestConfidence));

  // İki taraf da playful devam ediyorsa sarcasm confidence'ı düşür.
  if (play > 0 && conflict === 0 && humorEmoji && !rollingEyes) {
    if (bestConfidence > 0) {
      return {
        tag: 'humor_playful',
        confidence: Math.min(1, 0.6 + (extendedLaugh ? 0.15 : 0)),
        evidence: [evd('playful context', 'her iki taraf playful tonda', 'context'), ...bestEvidence],
        counterEvidence: [evd(matchedCueLabel ?? 'sarcasm cue', 'tek başına sarcasm sayılmaz, bağlam playful', 'context')],
        modifiers: { dampensWarmth: false, intensifierDrag, rollingEyes },
      };
    }
  }

  // Rolling-eyes tek başına da güçlü sinyal — lexicon eşleşmesi yoksa bile.
  if (!matchedCueLabel && rollingEyes) {
    const conf = 0.5 + (conflict > 0 ? 0.15 : 0);
    return {
      tag: 'sarcasm_possible',
      confidence: Math.min(1, conf),
      evidence: [evd('🙄/😒', 'sarcasm emoji', 'emoji')],
      counterEvidence: repairAfter ? [evd('next: repair/warmth', 'sonraki mesajda yumuşama', 'context')] : [],
      modifiers: { dampensWarmth: true, intensifierDrag, rollingEyes },
    };
  }

  if (matchedCueLabel && bestConfidence >= 0.45) {
    // Yeterince güçlü: sarcasm_possible
    return {
      tag: 'sarcasm_possible',
      confidence: bestConfidence,
      evidence: bestEvidence,
      counterEvidence: repairAfter ? [evd('next: repair/warmth', 'sonraki mesajda yumuşama; sarcasm zayıf', 'context')] : [],
      modifiers: { dampensWarmth: true, intensifierDrag, rollingEyes },
    };
  }

  // "positive literal but negative context" — explicit cue yok ama prev conflict + positive lafız
  const positiveLiteralRegex = /\b(?:harika|m[üu]kemmel|s[üu]per|bravo|aferin|tabii|tabi)\b/iu;
  if (positiveLiteralRegex.test(text) && conflict >= 1 && !humorEmoji) {
    return {
      tag: 'positive_literal_but_negative_context',
      confidence: 0.5,
      evidence: [evd('pozitif lafız', 'pozitif kelime + negatif önceki bağlam', 'context')],
      counterEvidence: [],
      modifiers: { dampensWarmth: true, intensifierDrag, rollingEyes },
    };
  }

  return base('none', 0, { dampensWarmth: false, intensifierDrag, rollingEyes });
};

const base = (
  tag: SarcasmTag,
  conf: number,
  modifiers: SarcasmResult['modifiers'] = { dampensWarmth: false, intensifierDrag: false, rollingEyes: false }
): SarcasmResult => ({
  tag,
  confidence: conf,
  evidence: [],
  counterEvidence: [],
  modifiers,
});
