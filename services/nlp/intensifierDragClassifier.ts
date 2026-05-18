// intensifierDragClassifier — warm-term/filler üzerindeki harf-tekrarı drag'ini
// hangi anlama geldiğini ayırır:
//   intensified_endearment : "aşkımmmm", "bitanemmmm" (flört intensifier)
//   intensified_filler     : "tabiii canım" (no-conflict context'te)
// neutral_filler + prev conflict varsa → sarcasm classifier üstlenir, biz none döneriz.
// onWarmTerm=true ise sarcasmResult.counterEvidence'a enjeksiyon yapılır (index.ts).

import { detectIntensifierDrag, type DragBase, type DragDetection } from './learned/learnedIntensifierDrag';
import { prevConflictLevel } from './contextWindow';
import { maskSensitiveText } from '../turkishLemma';
import type { ClassifierResult, ContextWindow } from './types';

export interface IntensifierDragResult extends ClassifierResult {
  tag: 'intensified_endearment' | 'intensified_filler' | 'none';
  modifiers: {
    dragHits: Array<{ base: DragBase; repeatLen: number }>;
    onWarmTerm: boolean;
    onFiller: boolean;
    maxRepeatLen: number;
  };
}

const clamp = (n: number): number => Math.max(0, Math.min(1, n));

const evd = (
  span: string,
  reason: string,
  source: 'learned_pattern' | 'context' | 'rule'
) => ({ span, reason, source });

/** name_like span'ı evidence'a maskelenmiş halde geçer. */
const safeSpan = (d: DragDetection): string => {
  if (d.base === 'name_like') return `[${d.base}]:${maskSensitiveText(d.span, 40)}`;
  return d.span;
};

export const classifyIntensifierDrag = (ctx: ContextWindow): IntensifierDragResult => {
  const m = ctx.target;
  const text = m.content || '';
  const hits = detectIntensifierDrag(text);

  if (!hits.length) {
    return {
      tag: 'none',
      confidence: 0,
      evidence: [],
      counterEvidence: [],
      modifiers: { dragHits: [], onWarmTerm: false, onFiller: false, maxRepeatLen: 0 },
    };
  }

  const onWarmTerm = hits.some(h => h.base === 'warm_term');
  const onFiller = hits.some(h => h.base === 'neutral_filler');
  const maxRepeatLen = Math.max(...hits.map(h => h.repeatLen));
  const dragHits = hits.map(h => ({ base: h.base, repeatLen: h.repeatLen }));

  // Warm-term drag → flört intensifier
  if (onWarmTerm) {
    const wmHits = hits.filter(h => h.base === 'warm_term');
    const conf = clamp(0.65 + (wmHits[0].repeatLen - 3) * 0.02);
    return {
      tag: 'intensified_endearment',
      confidence: conf,
      evidence: wmHits.map(h => evd(safeSpan(h), `warm-term drag: ${h.baseToken} ×${h.repeatLen}`, 'learned_pattern')),
      counterEvidence: [],
      modifiers: { dragHits, onWarmTerm, onFiller, maxRepeatLen },
    };
  }

  // Neutral filler drag → sarcasm üstlenir (prev conflict varsa)
  if (onFiller) {
    const conflict = prevConflictLevel(ctx);
    if (conflict >= 1) {
      // Sarcasm classifier zaten bu durumu yakalıyor; biz "none" döneriz.
      return {
        tag: 'none',
        confidence: 0,
        evidence: [],
        counterEvidence: [],
        modifiers: { dragHits, onWarmTerm, onFiller, maxRepeatLen },
      };
    }
    return {
      tag: 'intensified_filler',
      confidence: 0.5,
      evidence: hits
        .filter(h => h.base === 'neutral_filler')
        .map(h => evd(safeSpan(h), `filler drag: ${h.baseToken}`, 'learned_pattern')),
      counterEvidence: [],
      modifiers: { dragHits, onWarmTerm, onFiller, maxRepeatLen },
    };
  }

  // positive_adverb / expletive_soft / name_like → düşük signal
  return {
    tag: 'none',
    confidence: 0,
    evidence: [],
    counterEvidence: [],
    modifiers: { dragHits, onWarmTerm: false, onFiller: false, maxRepeatLen },
  };
};

/**
 * Drag warm-term'üzerindeyse sarcasm sonucuna counterEvidence enjekte eder.
 * index.ts orkestratöründen çağrılır; sarcasm visibility'sini düşürmek için.
 */
export const injectSarcasmCounter = (
  sarcasmResult: ClassifierResult,
  dragResult: IntensifierDragResult
): void => {
  if (!dragResult.modifiers.onWarmTerm) return;
  if (sarcasmResult.tag !== 'sarcasm_possible' && sarcasmResult.tag !== 'positive_literal_but_negative_context') return;
  sarcasmResult.counterEvidence = [
    ...sarcasmResult.counterEvidence,
    {
      span: 'warm-term drag',
      reason: 'drag base = warm_term, sarcasm değil flört intensifier',
      source: 'context',
    },
  ];
};
