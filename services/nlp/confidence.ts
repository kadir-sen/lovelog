// confidence — bir mesajın classifier sonuçlarından birleşik confidence ve
// "görünür mü" kararı üretir. UI/raporlama bu eşiklerle filtreler.

import type { ClassifierResult } from './types';

export const CONFIDENCE_THRESHOLDS = {
  minVisible: 0.55,         // bunun altındaki insight UI'da gösterilmez
  highVisible: 0.7,         // counterEvidence yoksa öne çıkarılabilir
  reviewLow: 0.45,
  reviewHigh: 0.75,
};

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export const aggregateConfidence = (results: ClassifierResult[]): number => {
  const valid = results.filter(r => r.tag !== 'none' && r.confidence > 0);
  if (!valid.length) return 0;
  // En yüksek skoru baz al; counterEvidence varsa orantılı düş.
  const max = Math.max(...valid.map(r => r.confidence));
  const counterPenalty = Math.min(0.25, valid.reduce((s, r) => s + r.counterEvidence.length * 0.05, 0));
  return clamp01(max - counterPenalty);
};

export const isVisible = (confidence: number, hasCounter: boolean): boolean => {
  if (confidence < CONFIDENCE_THRESHOLDS.minVisible) return false;
  if (hasCounter && confidence < CONFIDENCE_THRESHOLDS.highVisible) return false;
  return true;
};

export const needsReview = (confidence: number): boolean =>
  confidence >= CONFIDENCE_THRESHOLDS.reviewLow && confidence <= CONFIDENCE_THRESHOLDS.reviewHigh;
