// echoResponseClassifier — A warm → B warm reciprocity (echo) tespiti.
// Pencere boyutu 3 mesaj + 30 dk gap eşiği (planda gerekçeli).
// index.ts orkestratörü `out[]` üzerinden son N enriched insight'ı sağlar.

import type { ClassifierResult } from './types';
import type { EnrichedInsight } from './types';
import type { NormalizedMessage } from '../../types';

export const ECHO_WINDOW = 3;
export const ECHO_FAST_GAP_MIN = 30;
export const ECHO_SLOW_GAP_MIN = 120;

export interface EchoResult extends ClassifierResult {
  tag: 'echo_warmth' | 'none';
  modifiers: {
    echoLagMessages: number;
    echoLagMinutes: number | null;
    counterpartAuthor: string;
  };
}

const evd = (
  span: string,
  reason: string,
  source: 'context' | 'learned_pattern' | 'rule'
) => ({ span, reason, source });

const targetIsWarm = (target: NormalizedMessage, recentTag?: string): boolean => {
  // Mesajın warmth taşıdığını birkaç sinyalle kontrol et:
  // - affection.score > 0 (extractRelationshipSignals çıktısı)
  // - emoji_cluster veya inside_joke_pattern modifier
  if (target.signals?.love > 0) return true;
  if (target.adjustedSignals?.love > 0) return true;
  if (recentTag === 'emoji_cluster' || recentTag === 'inside_joke_pattern') return true;
  return false;
};

const insightWarmthScore = (ins: EnrichedInsight): number => {
  // affection signal score'u + emoji cluster modifier'ı varsa boost.
  let s = ins.signals?.affection?.score ?? 0;
  if (ins.modifiers?.emojiCluster) s = Math.max(s, 0.6);
  if (ins.classifierTags?.some(t => t.tag === 'ritual_message' || t.tag === 'warm_ack' || t.tag === 'affection')) {
    s = Math.max(s, 0.6);
  }
  return s;
};

const minutesBetween = (a: Date, b: Date): number =>
  Math.abs(b.getTime() - a.getTime()) / 60000;

export interface EchoInput {
  target: NormalizedMessage;
  /** Mevcut target için classifier tag (cluster vs) — warmth tespiti için ipucu. */
  targetTagsHint?: string[];
  /** Daha önce hesaplanmış enriched insight'lar (en yenisi en sonda). */
  priorInsights: EnrichedInsight[];
}

export const classifyEchoResponse = (input: EchoInput): EchoResult => {
  const { target, priorInsights, targetTagsHint } = input;

  // Mesaj kendisi warm olmalı (echo'nun kendisi karşı warm)
  const selfWarm =
    target.signals?.love > 0 ||
    target.adjustedSignals?.love > 0 ||
    (targetTagsHint ?? []).some(t => t === 'emoji_cluster' || t === 'inside_joke_pattern' || t === 'warm_ack' || t === 'ritual_message');
  if (!selfWarm) {
    return {
      tag: 'none',
      confidence: 0,
      evidence: [],
      counterEvidence: [],
      modifiers: { echoLagMessages: 0, echoLagMinutes: null, counterpartAuthor: '' },
    };
  }

  // Geriye N=ECHO_WINDOW mesaj bak, farklı yazardan warm bulmaya çalış.
  const start = Math.max(0, priorInsights.length - ECHO_WINDOW);
  for (let i = priorInsights.length - 1, lag = 1; i >= start; i--, lag++) {
    const ins = priorInsights[i];
    if (ins.speaker === target.author) continue; // farklı yazar şartı
    const warmth = insightWarmthScore(ins);
    if (warmth <= 0) continue;
    const lagMin = minutesBetween(new Date(ins.timestamp), target.date);
    if (lagMin > ECHO_SLOW_GAP_MIN) return baseNone(lag);
    const conf = lagMin <= ECHO_FAST_GAP_MIN ? 0.65 : 0.5;
    return {
      tag: 'echo_warmth',
      confidence: conf,
      evidence: [evd(`prev=${ins.speaker}`, `önceki warm mesaj (lag=${lag} msg, ${Math.round(lagMin)} dk)`, 'context')],
      counterEvidence: [],
      modifiers: {
        echoLagMessages: lag,
        echoLagMinutes: Math.round(lagMin),
        counterpartAuthor: ins.speaker,
      },
    };
  }

  return baseNone(0);
};

const baseNone = (lag: number): EchoResult => ({
  tag: 'none',
  confidence: 0,
  evidence: [],
  counterEvidence: [],
  modifiers: { echoLagMessages: lag, echoLagMinutes: null, counterpartAuthor: '' },
});

/** Echo bulgusu varsa affection.score'a küçük katkı (+0.10 cap 1.0). */
export const applyEchoBoost = (
  signals: import('../../types').MessageSignal,
  result: EchoResult
): void => {
  if (result.tag === 'none') return;
  signals.affection.score = Math.min(1, signals.affection.score + 0.1);
};
