// services/nlp/styleProfile.ts — runtime'da NormalizedMessage[] üzerinden
// ConversationStyleProfile hesaplar ve default (öğrenilmiş) bir profile da
// sağlar. Tüm fonksiyonlar pure: yan etki yok, IO yok.

import type {
  AuthorStyleProfile,
  ConversationStyleProfile,
  NormalizedMessage,
} from '../../types';

import { learnedWarmTerms, learnedPlayfulInsults } from './learned/learnedWarmTerms';
import { learnedLaughTokenRegex, learnedLaughBaseTokens } from './learned/learnedLaughPatterns';
import { learnedEmojiSemantics } from './learned/learnedEmojiSemantics';
import { learnedSarcasmCues } from './learned/learnedSarcasmCues';
import { learnedColdAckCues } from './learned/learnedShortReplyCues';
import { learnedCareCheckinCues } from './learned/learnedCareCheckinCues';
import { learnedControlPressureCues } from './learned/learnedControlPressureCues';
import { learnedCustomAffectionEmojis } from './learned/learnedCustomAffectionEmojis';
import { extractEmojiSequence } from './learned/learnedEmojiClusters';
import { findRitualMatches, ritualWindowFor, type RitualKind } from './learned/learnedRitualPhrases';
import { detectIntensifierDrag } from './learned/learnedIntensifierDrag';

const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
const REPEATED_CHAR_REGEX = /([\p{L}])\1{2,}/giu;

const emptyAuthor = (): AuthorStyleProfile => ({
  avgMessageLength: 0,
  shortReplyRate: 0,
  topEmojis: [],
  topLaughPatterns: [],
  warmTermUsage: [],
  punctuationStyle: { dotEndingRate: 0, ellipsisRate: 0, questionRate: 0, exclamationRate: 0 },
  baselineTone: { playfulRate: 0, affectionateRate: 0, conflictRate: 0, sarcasmCandidateRate: 0 },
});

const bump = <K>(m: Map<K, number>, k: K): void => {
  m.set(k, (m.get(k) ?? 0) + 1);
};

const top = <K>(m: Map<K, number>, n: number): K[] =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

/**
 * Default profile — annotation pipeline'ından öğrenilmiş genelleştirilmiş
 * dialect. Belirli sohbet/kişiye ait raw veri içermez.
 */
export const DEFAULT_STYLE_PROFILE: ConversationStyleProfile = {
  authors: { A: emptyAuthor(), B: emptyAuthor() },
  relationshipDialect: {
    warmTerms: [...learnedWarmTerms],
    playfulInsults: [...learnedPlayfulInsults],
    sarcasmCuePatterns: learnedSarcasmCues.map(c => c.label),
    coldAckPatterns: [...learnedColdAckCues],
    careCheckinPatterns: [...learnedCareCheckinCues],
    controlPressurePatterns: [...learnedControlPressureCues],
    laughPatterns: [...learnedLaughBaseTokens],
    emojiSemantics: { ...learnedEmojiSemantics },
    insideJokeCandidates: [],
  },
};

/** Tek bir AuthorStyleProfile hesaplar — pure, side-effect yok. */
const computeAuthor = (msgs: NormalizedMessage[]): AuthorStyleProfile => {
  if (!msgs.length) return emptyAuthor();
  const emoji = new Map<string, number>();
  const laugh = new Map<string, number>();
  const warm = new Map<string, number>();

  let chars = 0;
  let short = 0;
  let qMarks = 0;
  let exMarks = 0;
  let dotEnd = 0;
  let ellipsis = 0;
  let playful = 0;
  let affection = 0;
  let conflict = 0;
  let sarcasmCand = 0;

  for (const m of msgs) {
    const text = m.content || '';
    chars += text.length;
    if (m.isShortReply) short++;
    qMarks += (text.match(/\?/g) ?? []).length;
    exMarks += (text.match(/!/g) ?? []).length;
    if (/\.\s*$/.test(text)) dotEnd++;
    if (/\.\.\.\s*$/.test(text) || /…\s*$/.test(text)) ellipsis++;

    const emojis = text.match(EMOJI_REGEX);
    if (emojis) for (const e of emojis) bump(emoji, e);

    const laughs = text.match(learnedLaughTokenRegex);
    if (laughs) for (const l of laughs) bump(laugh, l.toLowerCase());

    const tlc = text.toLocaleLowerCase('tr-TR');
    for (const w of learnedWarmTerms) if (tlc.includes(w)) bump(warm, w);

    if (m.playfulnessFlag) playful++;
    if (m.signals.love > 0 || m.adjustedSignals.love > 0) affection++;
    if (m.adjustedSignals.harsh > 0 || m.adjustedSignals.tension > 0) conflict++;
    if (/🙄|😒/u.test(text)) sarcasmCand++;
  }

  const n = msgs.length;
  return {
    avgMessageLength: Number((chars / n).toFixed(2)),
    shortReplyRate: Number((short / n).toFixed(3)),
    topEmojis: top(emoji, 8),
    topLaughPatterns: top(laugh, 8),
    warmTermUsage: top(warm, 8),
    punctuationStyle: {
      dotEndingRate: Number((dotEnd / n).toFixed(3)),
      ellipsisRate: Number((ellipsis / n).toFixed(3)),
      questionRate: Number((qMarks / n).toFixed(3)),
      exclamationRate: Number((exMarks / n).toFixed(3)),
    },
    baselineTone: {
      playfulRate: Number((playful / n).toFixed(3)),
      affectionateRate: Number((affection / n).toFixed(3)),
      conflictRate: Number((conflict / n).toFixed(3)),
      sarcasmCandidateRate: Number((sarcasmCand / n).toFixed(3)),
    },
  };
};

/**
 * Repo'daki normalizedMessages üzerinden ConversationStyleProfile üretir.
 * En aktif iki yazarı A/B'ye eşler; default dialect ile birleştirir.
 * PR-9: emojiPairFrequency, ritualTimeDistribution, customAffectionEmojis,
 * intensifierDragSamples, authorAffectionLeaning ek alanlarını üretir.
 */
export const buildStyleProfile = (
  messages: NormalizedMessage[]
): ConversationStyleProfile => {
  const counts = new Map<string, number>();
  for (const m of messages) bump(counts, m.author);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const authorA = sorted[0]?.[0];
  const authorB = sorted[1]?.[0];

  const a = authorA ? messages.filter(m => m.author === authorA) : [];
  const b = authorB ? messages.filter(m => m.author === authorB) : [];

  const repeated = new Map<string, number>();
  for (const m of messages) {
    const r = m.content?.match(REPEATED_CHAR_REGEX);
    if (r) for (const w of r) bump(repeated, w.toLowerCase());
  }

  // --- PR-9 ek hesaplamalar (tek-tarayışta) ---
  const pairFreq = new Map<string, number>();
  const customEmojiSeen = new Set<string>();
  const ritualDist = new Map<RitualKind, { night: number; morning: number; day: number; total: number }>();
  const dragCounts = new Map<string, number>();

  for (const m of messages) {
    const text = m.content || '';
    if (!text) continue;
    // Emoji pairs (window=2)
    const es = extractEmojiSequence(text);
    for (let i = 1; i < es.length; i++) {
      const pair = `${es[i - 1]}${es[i]}`;
      bump(pairFreq, pair);
    }
    for (const e of es) if (learnedCustomAffectionEmojis.includes(e)) customEmojiSeen.add(e);

    // Ritual saat dağılımı
    const ritualMatches = findRitualMatches(text);
    if (ritualMatches.length) {
      const tod = ritualWindowFor(m.date.getHours());
      for (const r of ritualMatches) {
        const k = r.kind;
        if (!ritualDist.has(k)) ritualDist.set(k, { night: 0, morning: 0, day: 0, total: 0 });
        const slot = ritualDist.get(k)!;
        slot[tod]++;
        slot.total++;
      }
    }

    // Intensifier-drag sayımı (base bazında)
    const drags = detectIntensifierDrag(text);
    for (const d of drags) bump(dragCounts, d.base);
  }

  const emojiPairFrequency = [...pairFreq.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 12)
    .map(([pair, count]) => ({ pair, count }));

  const intensifierDragSamples = [...dragCounts.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 12)
    .map(([base, count]) => ({ base, count }));

  const authorAProfile = computeAuthor(a);
  const authorBProfile = computeAuthor(b);

  const authorAffectionLeaning = {
    A: {
      dominantEmoji: authorAProfile.topEmojis[0],
      warmTermTop: authorAProfile.warmTermUsage[0],
    },
    B: {
      dominantEmoji: authorBProfile.topEmojis[0],
      warmTermTop: authorBProfile.warmTermUsage[0],
    },
  };

  const ritualTimeDistribution: Record<string, { night: number; morning: number; day: number; total: number }> = {};
  for (const [k, v] of ritualDist) ritualTimeDistribution[k] = v;

  return {
    ...DEFAULT_STYLE_PROFILE,
    authors: { A: authorAProfile, B: authorBProfile },
    relationshipDialect: {
      ...DEFAULT_STYLE_PROFILE.relationshipDialect,
      insideJokeCandidates: top(repeated, 12),
      emojiPairFrequency,
      ritualTimeDistribution,
      customAffectionEmojis: [...customEmojiSeen],
      intensifierDragSamples,
      authorAffectionLeaning,
    },
  };
};
