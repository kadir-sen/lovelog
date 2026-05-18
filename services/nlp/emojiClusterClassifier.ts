// emojiClusterClassifier — ardışık emoji blokları için classifier.
//   emoji_cluster        : 😘😘 / 😙😙😙 / 🥳🥳🥳 / 😘❤️ vb.
//   inside_joke_pattern  : warm-term + custom-affection-emoji co-occurrence (aşkım × 🐬)
// Mevcut affection.score üzerinde çarpan; ezmez. Pure function.

import {
  type EmojiClusterKind,
  EMOJI_CLUSTER_BURST_THRESHOLD,
  KISS_FAMILY,
  CELEBRATION_FAMILY,
  extractEmojiSequence,
  learnedEmojiClusters,
} from './learned/learnedEmojiClusters';
import { findCustomBinding, type AffectionTerm } from './learned/learnedEmojiTermBindings';
import type { ClassifierResult, ContextWindow } from './types';

export interface EmojiClusterResult extends ClassifierResult {
  tag: 'emoji_cluster' | 'inside_joke_pattern' | 'none';
  modifiers: {
    clusterKind?: EmojiClusterKind;
    clusterSize: number;
    bursting: boolean;
    customAffection: boolean;
    boundWarmTerm?: AffectionTerm;
  };
}

const evd = (
  span: string,
  reason: string,
  source: 'cluster' | 'emoji' | 'learned_pattern' | 'rule'
) => ({ span, reason, source });

const clamp = (n: number): number => Math.max(0, Math.min(1, n));

export const classifyEmojiCluster = (ctx: ContextWindow): EmojiClusterResult => {
  const m = ctx.target;
  const text = m.content || '';
  const emojis = extractEmojiSequence(text);
  const size = emojis.length;

  // Erken-çıkış sadece "hiç emoji yok" durumu için. Tek emoji bile olsa custom
  // affection binding (warm-term × özel emoji) inside_joke_pattern'ı tetikler.
  if (size === 0) {
    return {
      tag: 'none',
      confidence: 0,
      evidence: [],
      counterEvidence: [],
      modifiers: { clusterSize: size, bursting: false, customAffection: false },
    };
  }

  // İlk eşleşen cluster kategorisini seç (sıralama önemli: 3plus > 2 > kiss-burst > ...).
  let matched: { kind: EmojiClusterKind; weight: number } | null = null;
  for (const c of learnedEmojiClusters) {
    if (c.matcher(emojis as string[])) {
      matched = { kind: c.kind, weight: c.weight };
      break;
    }
  }

  const bursting = size >= EMOJI_CLUSTER_BURST_THRESHOLD;
  const customBinding = findCustomBinding(text, emojis);
  const customAffection = !!customBinding;

  // Custom binding varsa → inside_joke_pattern öncelikli.
  if (customBinding) {
    const baseConf = matched ? matched.weight : 0.6;
    return {
      tag: 'inside_joke_pattern',
      confidence: clamp(baseConf + 0.1 + (bursting ? 0.1 : 0)),
      evidence: [
        evd(`${customBinding.term} × ${customBinding.emoji}`, 'warm term + custom-affection emoji co-occurrence', 'learned_pattern'),
        ...(matched ? [evd(matched.kind, 'emoji cluster ailesinde', 'cluster')] : []),
      ],
      counterEvidence: [],
      modifiers: {
        clusterKind: matched?.kind,
        clusterSize: size,
        bursting,
        customAffection: true,
        boundWarmTerm: customBinding.term,
      },
    };
  }

  if (!matched) {
    return {
      tag: 'none',
      confidence: 0,
      evidence: [],
      counterEvidence: [],
      modifiers: { clusterSize: size, bursting, customAffection: false },
    };
  }

  const confidence = clamp(matched.weight + (bursting ? 0.1 : 0));
  return {
    tag: 'emoji_cluster',
    confidence,
    evidence: [evd(matched.kind, `emoji cluster: ${matched.kind}, size=${size}`, 'cluster')],
    counterEvidence: [],
    modifiers: {
      clusterKind: matched.kind,
      clusterSize: size,
      bursting,
      customAffection: false,
    },
  };
};

// Cluster bulgusunun affection.score üzerinde uygulanacak ek katkı (mutate eden
// fonksiyon; index.ts orkestratöründen çağrılır).
export const applyEmojiClusterBoost = (
  signals: import('../../types').MessageSignal,
  result: EmojiClusterResult
): void => {
  if (result.tag === 'none') return;
  const kind = result.modifiers.clusterKind;
  if (!kind) return;
  // Same-repeat-3plus affection family → +0.20
  if (kind === 'same_repeat_3plus' || kind === 'kiss_burst' || kind === 'mixed_affection_trio') {
    signals.affection.score = Math.min(1, signals.affection.score + 0.2);
  } else if (kind === 'celebration_burst') {
    signals.humor.score = Math.min(1, signals.humor.score + 0.15);
  } else if (kind === 'same_repeat_2' || kind === 'mixed_affection_pair' || kind === 'kiss_mixed') {
    signals.affection.score = Math.min(1, signals.affection.score + 0.1);
  }
  if (result.tag === 'inside_joke_pattern') {
    signals.humor.score = Math.min(1, signals.humor.score + 0.15);
    signals.affection.score = Math.min(1, signals.affection.score + 0.05);
  }
};

// Sarcasm dampener'ı bypass etmek için "min floor" uygulanır: cluster bulunursa
// affection.score sarcasm tarafından 0'a indirilse bile 0.3'e geri yükseltir.
export const enforceAffectionFloor = (
  signals: import('../../types').MessageSignal,
  result: EmojiClusterResult,
  floor = 0.3
): void => {
  if (result.tag === 'none') return;
  if (signals.affection.playfulDampened || signals.affection.negated) {
    if (signals.affection.score < floor) signals.affection.score = floor;
  }
};
