// laughClassifier — bir mesajdaki gülme'nin "kind"ını seçer.
//   real_laugh      : önceki context komik/playful
//   softener_laugh  : kötü haber sunarken yumuşatma (acı + 😅 / 🥲)
//   awkward_laugh   : ağır/duygusal contextin hemen ardından gülme
//   defensive_laugh : eleştiri/blame contextine yanıt olarak gülme
//   sarcastic_laugh : pozitif lafız + sarcasm cue + rolling eye
//   flirty_laugh    : flörtöz emoji eşliğinde gülme

import type { NormalizedMessage } from '../../types';
import {
  learnedLaughTokenRegex,
  learnedExtendedLaughRegex,
  type LearnedLaughPattern,
  learnedLaughPatterns,
  calibrateLaughWeight,
} from './learned/learnedLaughPatterns';
import {
  affectionEmojiRegex,
  sarcasmEmojiRegex,
  sadnessEmojiRegex,
} from './learned/learnedEmojiSemantics';
import { prevConflictLevel, prevPlayLevel, prevAffectionLevel } from './contextWindow';
import type { ClassifierResult, ContextWindow } from './types';

const evd = (span: string, reason: string, source: 'rule' | 'learned_pattern' | 'context' | 'emoji'): {
  span: string; reason: string; source: 'rule' | 'learned_pattern' | 'context' | 'emoji';
} => ({ span, reason, source });

const detectLaughHits = (text: string): LearnedLaughPattern[] => {
  return learnedLaughPatterns.filter(p => p.pattern.test(text));
};

export interface LaughResult extends ClassifierResult {
  tag:
    | 'real_laugh'
    | 'softener_laugh'
    | 'awkward_laugh'
    | 'defensive_laugh'
    | 'sarcastic_laugh'
    | 'flirty_laugh'
    | 'none';
}

export const classifyLaugh = (ctx: ContextWindow): LaughResult => {
  const m = ctx.target;
  const text = m.content || '';
  const hits = detectLaughHits(text);
  const hasLaugh = hits.length > 0 || learnedLaughTokenRegex.test(text);

  if (!hasLaugh) {
    return {
      tag: 'none',
      confidence: 0,
      evidence: [],
      counterEvidence: [],
    };
  }

  const playLevel = prevPlayLevel(ctx);
  const conflictLevel = prevConflictLevel(ctx);
  const affLevel = prevAffectionLevel(ctx);
  const extended = learnedExtendedLaughRegex.test(text);
  const sarcasm = sarcasmEmojiRegex.test(text);
  const sadness = sadnessEmojiRegex.test(text);
  const flirt = affectionEmojiRegex.test(text);

  const evidence = [evd(hits.map(h => h.label).join(',') || 'laugh', 'gülme tokenı tespit edildi', 'learned_pattern')];
  const counter: ReturnType<typeof evd>[] = [];

  // Karar matrisi — sırasıyla, ilk eşleşen kazanır.
  if (sarcasm) {
    return {
      tag: 'sarcastic_laugh',
      confidence: 0.7,
      evidence: [...evidence, evd('🙄/😒', 'sarcasm emojisi eşliğinde gülme', 'emoji')],
      counterEvidence: counter,
    };
  }
  if (conflictLevel >= 2 && !extended) {
    return {
      tag: 'defensive_laugh',
      confidence: 0.6,
      evidence: [...evidence, evd('prev: conflict', 'önceki bağlamda eleştiri/sertlik var', 'context')],
      counterEvidence: counter,
    };
  }
  if (sadness && !extended) {
    return {
      tag: 'softener_laugh',
      confidence: 0.55,
      evidence: [...evidence, evd('😢/🥺', 'üzüntü emojisi ile yumuşatıcı gülme', 'emoji')],
      counterEvidence: counter,
    };
  }
  if (flirt && playLevel > 0) {
    return {
      tag: 'flirty_laugh',
      confidence: 0.6,
      evidence: [...evidence, evd('affection-emoji + play', 'flört bağlamında gülme', 'emoji')],
      counterEvidence: counter,
    };
  }
  if (conflictLevel >= 1 && playLevel === 0) {
    return {
      tag: 'awkward_laugh',
      confidence: 0.55,
      evidence: [...evidence, evd('prev: hafif gerilim', 'gergin bağlamın hemen sonrasında gülme', 'context')],
      counterEvidence: counter,
    };
  }
  if (playLevel > 0 || affLevel > 0 || extended) {
    // PR-1: token-uzunluğu bonus'u — "kkkkkkkkk" gibi uzun zincirlerde +0..0.10.
    const firstHit = learnedLaughTokenRegex.exec(text)?.[0] ?? '';
    learnedLaughTokenRegex.lastIndex = 0;
    const base = extended ? 0.85 : 0.7;
    return {
      tag: 'real_laugh',
      confidence: calibrateLaughWeight(firstHit, base),
      evidence: [...evidence, evd('prev: playful/affection', 'önceki bağlam playful', 'context')],
      counterEvidence: counter,
    };
  }
  // Default: real laugh ama düşük confidence
  return {
    tag: 'real_laugh',
    confidence: 0.55,
    evidence,
    counterEvidence: counter,
  };
};
