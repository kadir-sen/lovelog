// controlPressureClassifier — care_checkin / neutral_question / control_pressure / jealousy_check.

import type { ClassifierResult, ContextWindow } from './types';
import { prevConflictLevel, nextRepairOrWarmth } from './contextWindow';
import {
  learnedControlPressureCueObjects,
  learnedJealousyCheckCues,
} from './learned/learnedControlPressureCues';
import {
  learnedCareCheckinPatterns,
  learnedAmbiguousLocationQuery,
} from './learned/learnedCareCheckinCues';
import { learnedPhraseWeights } from './learned/learnedPhraseWeights';

export type CcpTag =
  | 'care_checkin'
  | 'neutral_question'
  | 'control_pressure'
  | 'jealousy_check'
  | 'none';

export interface CcpResult extends ClassifierResult {
  tag: CcpTag;
}

const evd = (
  span: string,
  reason: string,
  source: 'rule' | 'learned_pattern' | 'context' | 'punctuation'
) => ({ span, reason, source });

const IMPERATIVE_TONE = /\bhemen\b|\başap\b|!{2,}|\?{2,}/iu;

const prevControlRepeats = (ctx: ContextWindow): number => {
  let count = 0;
  for (const p of ctx.prev) {
    if (p.author !== ctx.target.author) continue;
    if (learnedControlPressureCueObjects.some(c => c.pattern.test(p.content || ''))) count++;
  }
  return count;
};

export const classifyControlPressure = (ctx: ContextWindow): CcpResult => {
  const m = ctx.target;
  const text = m.content || '';
  if (!text.trim()) return { tag: 'none', confidence: 0, evidence: [], counterEvidence: [] };

  const controlHits = learnedControlPressureCueObjects.filter(c => c.pattern.test(text));
  const careHits = learnedCareCheckinPatterns.filter(r => r.test(text));
  const locHits = learnedAmbiguousLocationQuery.filter(r => r.test(text));
  const jealousyHits = learnedJealousyCheckCues.filter(r => r.test(text));
  const imperative = IMPERATIVE_TONE.test(text);
  const repeats = prevControlRepeats(ctx);
  const conflict = prevConflictLevel(ctx);
  const repairAfter = nextRepairOrWarmth(ctx);

  // 1) Açık control cue varsa → control_pressure
  if (controlHits.length) {
    const baseConf = Math.max(...controlHits.map(c => c.baseConfidence));
    const conf = Math.min(
      1,
      baseConf + repeats * 0.1 + (imperative ? 0.1 : 0) + (conflict > 0 ? 0.1 : 0)
    );
    const counter: ReturnType<typeof evd>[] = [];
    if (careHits.length) counter.push(evd(careHits.map(h => h.source).join(','), 'aynı mesajda care sinyali de var', 'learned_pattern'));
    if (repairAfter) counter.push(evd('next: repair/warmth', 'sonraki mesajda yumuşama', 'context'));
    return {
      tag: 'control_pressure',
      confidence: conf,
      evidence: [evd(controlHits.map(c => c.label).join(', '), 'baskı/sorgu cue', 'learned_pattern')],
      counterEvidence: counter,
    };
  }

  // 2) Açık jealousy_check cue varsa → jealousy_check
  if (jealousyHits.length) {
    return {
      tag: 'jealousy_check',
      confidence: Math.min(1, 0.55 + (conflict > 0 ? 0.15 : 0)),
      evidence: [evd(jealousyHits.map(r => r.source).join(', '), 'kıskançlık sorgusu', 'learned_pattern')],
      counterEvidence: [],
    };
  }

  // 3) Care cue varsa (ve emir tonu yok) → care_checkin
  if (careHits.length && !imperative && conflict === 0) {
    return {
      tag: 'care_checkin',
      confidence: learnedPhraseWeights.careOverControlThreshold,
      evidence: [evd(careHits.map(r => r.source).join(', '), 'care lexicon, baskı yok', 'learned_pattern')],
      counterEvidence: [],
    };
  }

  // 4) Ambiguous location query: "neredesin?" tek başına ne control ne care.
  if (locHits.length) {
    // Repeats / imperative / conflict varsa control'e doğru kayar
    if (repeats >= 1 || imperative || conflict >= 1) {
      const conf = 0.5 + repeats * 0.1 + (imperative ? 0.1 : 0);
      return {
        tag: 'control_pressure',
        confidence: Math.min(1, conf),
        evidence: [evd('neredesin', 'tekrarlı/emir tonlu konum sorgusu', 'context')],
        counterEvidence: [evd('neredesin', '"neredesin" tek başına kesin control değildir', 'rule')],
      };
    }
    // Care + neredesin: care_checkin
    if (careHits.length) {
      return {
        tag: 'care_checkin',
        confidence: 0.55,
        evidence: [evd('neredesin + care', 'sıcak/ilgili soru tonu', 'context')],
        counterEvidence: [],
      };
    }
    // Yalın "neredesin?" → neutral question
    return {
      tag: 'neutral_question',
      confidence: 0.5,
      evidence: [evd('neredesin', 'tekil konum sorusu, ek sinyal yok', 'rule')],
      counterEvidence: [],
    };
  }

  // 5) Care lexicon var ama emir tonu/conflict varsa: care confidence düş, çakışmayı işaretle
  if (careHits.length && (imperative || conflict > 0)) {
    return {
      tag: 'care_checkin',
      confidence: 0.5,
      evidence: [evd(careHits.map(r => r.source).join(', '), 'care lexicon', 'learned_pattern')],
      counterEvidence: [evd('imperative/conflict', 'aynı bağlamda baskı/öfke sinyali', 'context')],
    };
  }

  return { tag: 'none', confidence: 0, evidence: [], counterEvidence: [] };
};
