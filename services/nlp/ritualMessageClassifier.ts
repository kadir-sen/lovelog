// ritualMessageClassifier — saat-aware ritüel mesaj classifier'ı.
// "iyi geceler" 21:00'da → 'ritual_message' + inExpectedWindow=true (yüksek warmth).
// "iyi geceler" 09:00'da → tag aynı, ama out-of-window: düşük confidence + counterEvidence.

import {
  findRitualMatches,
  ritualWindowFor,
  type RitualKind,
} from './learned/learnedRitualPhrases';
import type { ClassifierResult, ContextWindow } from './types';

export interface RitualResult extends ClassifierResult {
  tag: 'ritual_message' | 'none';
  modifiers: {
    ritualKind?: RitualKind;
    timeOfDay?: 'night' | 'morning' | 'day';
    inExpectedWindow?: boolean;
  };
}

const evd = (
  span: string,
  reason: string,
  source: 'time' | 'learned_pattern' | 'context'
) => ({ span, reason, source });

export const classifyRitual = (ctx: ContextWindow): RitualResult => {
  const m = ctx.target;
  const text = m.content || '';
  if (!text.trim()) {
    return { tag: 'none', confidence: 0, evidence: [], counterEvidence: [], modifiers: {} };
  }

  const matches = findRitualMatches(text);
  if (!matches.length) {
    return { tag: 'none', confidence: 0, evidence: [], counterEvidence: [], modifiers: {} };
  }

  const hour = m.date.getHours();
  const timeOfDay = ritualWindowFor(hour);

  // İlk eşleşen ritüel kategorisi alınır.
  const ritual = matches[0];
  const expected = ritual.expectedWindow;
  const inExpectedWindow =
    expected === 'any' || expected === timeOfDay;

  const confidence = inExpectedWindow ? ritual.warmthInWindow : ritual.warmthOutOfWindow;

  const evidence = [
    evd(ritual.kind, 'ritual phrase eşleşmesi', 'learned_pattern'),
    evd(`hour=${hour}`, `time-of-day=${timeOfDay}, expected=${expected}`, 'time'),
  ];
  const counterEvidence: ReturnType<typeof evd>[] = [];
  if (!inExpectedWindow) {
    counterEvidence.push(
      evd(`hour=${hour}`, `ritüel beklenmedik saat dilim'inde — pragma zayıf`, 'time')
    );
  }

  return {
    tag: 'ritual_message',
    confidence,
    evidence,
    counterEvidence,
    modifiers: {
      ritualKind: ritual.kind,
      timeOfDay,
      inExpectedWindow,
    },
  };
};

/** Ritual sonucunun affection.score üzerinde uygulanacak ek katkı. */
export const applyRitualBoost = (
  signals: import('../../types').MessageSignal,
  result: RitualResult
): void => {
  if (result.tag === 'none') return;
  const boost = result.modifiers.inExpectedWindow ? 0.15 : 0.05;
  signals.affection.score = Math.min(1, signals.affection.score + boost);
};
