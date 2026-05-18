// evidence — classifier sonuçlarındaki ClassifierEvidence'ı types.ts'teki
// EvidenceItem şekline çevirir + masking uygular.

import type { EvidenceItem, NormalizedMessage } from '../../types';
import { maskSensitiveText } from '../turkishLemma';
import type { ClassifierEvidence, ClassifierResult } from './types';

const truncate = (s: string, max = 160): string => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export const toEvidenceItem = (
  m: NormalizedMessage,
  ce: ClassifierEvidence
): EvidenceItem => ({
  messageId: String(m.id),
  timestamp: m.date.toISOString(),
  speaker: m.author,
  quoteMasked: maskSensitiveText(truncate(ce.span || m.content)),
  reason: ce.reason,
});

export const collectEvidence = (
  m: NormalizedMessage,
  results: ClassifierResult[]
): { evidence: EvidenceItem[]; counterEvidence: EvidenceItem[] } => {
  const evidence: EvidenceItem[] = [];
  const counterEvidence: EvidenceItem[] = [];
  for (const r of results) {
    for (const ce of r.evidence) evidence.push(toEvidenceItem(m, ce));
    for (const ce of r.counterEvidence) counterEvidence.push(toEvidenceItem(m, ce));
  }
  return { evidence, counterEvidence };
};
