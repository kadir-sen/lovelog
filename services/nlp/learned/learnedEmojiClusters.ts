// Emoji cluster kategorileri — ardışık emoji blokları için sınıflandırma.
// emojiClusterClassifier bu kategorileri kullanarak "burst affection",
// "kiss burst", "mixed affection pair" gibi alt-tipleri tanımlar.

import type { EmojiSemantic } from './learnedEmojiSemantics';

export type EmojiClusterKind =
  | 'same_repeat_2'         // 😘😘
  | 'same_repeat_3plus'     // 😘😘😘
  | 'mixed_affection_pair'  // 😘❤️
  | 'mixed_affection_trio'  // ❤️🐰❤️ (3+ farklı affection)
  | 'celebration_burst'     // 🥳🥳🥳
  | 'kiss_burst'            // 😙😙😙 (kiss ailesi 3+)
  | 'kiss_mixed';           // 😘😚😙 (kiss ailesinin 2+ farklı üyesi)

export const EMOJI_CLUSTER_MIN_RUN = 2;
export const EMOJI_CLUSTER_BURST_THRESHOLD = 5;

// Emoji aileleri — phrase mining ve annotation veri madenciliğinden.
export const KISS_FAMILY: readonly string[] = ['😘', '😚', '😙', '💋'];
export const HEART_FAMILY: readonly string[] = ['❤️', '❤', '🤍', '💕', '💖', '💗', '💞', '💓'];
export const LAUGH_FAMILY: readonly string[] = ['😂', '🤣', '😅', '😆', '🥲', '🤭', '😹'];
export const CELEBRATION_FAMILY: readonly string[] = ['🥳', '🎉'];
export const MISC_WARMTH_FAMILY: readonly string[] = ['🥰', '😍', '🥵', '🤓', '🐰', '🐬', '🥹'];

export const ALL_AFFECTION_FAMILIES: readonly (readonly string[])[] = [
  KISS_FAMILY,
  HEART_FAMILY,
  MISC_WARMTH_FAMILY,
];

export interface LearnedEmojiCluster {
  kind: EmojiClusterKind;
  /** Emoji listesini sırasıyla alır, eşleşirse true. */
  matcher: (emojis: string[]) => boolean;
  /** Confidence katkı tabanı. */
  weight: number;
  /** Hangi semantic ailelere ait. */
  semanticFamily: EmojiSemantic[];
}

const inFamily = (e: string, family: readonly string[]): boolean => family.includes(e);
const familyOf = (e: string): readonly string[] | null => {
  for (const f of ALL_AFFECTION_FAMILIES) if (inFamily(e, f)) return f;
  return null;
};

const maxRun = (emojis: string[]): number => {
  if (!emojis.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < emojis.length; i++) {
    if (emojis[i] === emojis[i - 1]) {
      cur++;
      if (cur > best) best = cur;
    } else cur = 1;
  }
  return best;
};

const maxFamilyRun = (emojis: string[], family: readonly string[]): number => {
  if (!emojis.length) return 0;
  let best = 0;
  let cur = 0;
  for (const e of emojis) {
    if (inFamily(e, family)) {
      cur++;
      if (cur > best) best = cur;
    } else cur = 0;
  }
  return best;
};

const distinctInFamily = (emojis: string[], family: readonly string[]): number => {
  const set = new Set<string>();
  for (const e of emojis) if (inFamily(e, family)) set.add(e);
  return set.size;
};

export const learnedEmojiClusters: readonly LearnedEmojiCluster[] = [
  {
    kind: 'same_repeat_3plus',
    matcher: (es) => maxRun(es) >= 3,
    weight: 0.75,
    semanticFamily: ['affection'],
  },
  {
    kind: 'same_repeat_2',
    matcher: (es) => maxRun(es) === 2,
    weight: 0.6,
    semanticFamily: ['affection'],
  },
  {
    kind: 'kiss_burst',
    matcher: (es) => maxFamilyRun(es, KISS_FAMILY) >= 3,
    weight: 0.78,
    semanticFamily: ['affection', 'flirt'],
  },
  {
    kind: 'kiss_mixed',
    matcher: (es) => distinctInFamily(es, KISS_FAMILY) >= 2,
    weight: 0.7,
    semanticFamily: ['affection', 'flirt'],
  },
  {
    kind: 'celebration_burst',
    matcher: (es) => maxFamilyRun(es, CELEBRATION_FAMILY) >= 3,
    weight: 0.7,
    semanticFamily: ['celebration', 'humor'],
  },
  {
    kind: 'mixed_affection_pair',
    matcher: (es) => {
      // 2+ farklı affection ailesi ardışık iki pozisyonda
      for (let i = 1; i < es.length; i++) {
        const a = familyOf(es[i - 1]);
        const b = familyOf(es[i]);
        if (a && b && a !== b) return true;
      }
      return false;
    },
    weight: 0.65,
    semanticFamily: ['affection'],
  },
  {
    kind: 'mixed_affection_trio',
    matcher: (es) => {
      const families = new Set<readonly string[]>();
      for (const e of es) {
        const f = familyOf(e);
        if (f) families.add(f);
      }
      return families.size >= 3;
    },
    weight: 0.72,
    semanticFamily: ['affection'],
  },
] as const;

/** Helper: text içindeki emoji'leri sırasıyla çıkarır. */
export const EMOJI_EXTRACTION_REGEX: RegExp = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

export const extractEmojiSequence = (text: string): string[] => {
  if (!text) return [];
  const out = text.match(EMOJI_EXTRACTION_REGEX);
  return out ? Array.from(out) : [];
};
