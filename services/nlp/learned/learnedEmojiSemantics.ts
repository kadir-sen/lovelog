// Emoji → konuşma anlamı eşlemesi. Phrase mining'de bu sohbette baskın olan
// emojiler: warmth tarafında 😘 😚 😙 ❤ 🤍 🥰 ; humor tarafında 😂 🤣 😅 😆 ;
// sarcasm tarafında 🙄 😒 ; üzüntü 😢 😭 🥺 ; öfke 😡 🤬.
// Çoğu emoji çok-anlamlıdır; aşağıdaki liste sadece "dominant" anlamı gösterir.
// PR-1 ile genişletildi: 🥵 🐰 🐬 🥸 🫡 🤓 için jenerik semantikler eklendi;
// couple-spesifik affection bağlanmaları learnedCustomAffectionEmojis'te ayrı tutulur.

export type EmojiSemantic =
  | 'affection'
  | 'flirt'
  | 'humor'
  | 'softener'
  | 'contempt'
  | 'sarcasm'
  | 'sadness'
  | 'anger'
  | 'suspicion'
  | 'celebration'
  | 'acknowledgment';

export const learnedEmojiSemantics: Record<string, EmojiSemantic[]> = {
  '❤️': ['affection'],
  '❤': ['affection'],
  '💕': ['affection'],
  '💖': ['affection'],
  '💗': ['affection'],
  '💞': ['affection'],
  '💓': ['affection'],
  '🤍': ['affection'],
  '🥰': ['affection'],
  '😍': ['affection', 'flirt'],
  '😘': ['affection', 'flirt'],
  '😚': ['affection'],
  '😙': ['affection'],
  '💋': ['flirt'],
  '😂': ['humor'],
  '🤣': ['humor'],
  '😅': ['humor', 'softener'],
  '😆': ['humor'],
  '🥲': ['humor', 'softener'],
  '🤭': ['humor', 'softener'],
  '😒': ['contempt', 'sarcasm'],
  '🙄': ['sarcasm', 'contempt'],
  '😢': ['sadness'],
  '😭': ['sadness'],
  '🥺': ['sadness', 'softener'],
  '😡': ['anger'],
  '🤬': ['anger'],
  '👀': ['suspicion'],
  '🎉': ['celebration'],
  '🥳': ['celebration'],
  // PR-1: yüksek frekanslı ama daha önce tanımsız emojiler.
  '🥵': ['flirt', 'humor'],
  '🐰': ['affection', 'softener'],
  '🐬': ['softener'],
  '🥸': ['humor', 'softener'],
  '🫡': ['acknowledgment', 'humor'],
  '🤓': ['humor', 'softener'],
};

/** "Affection" emojileri set olarak tek seferde sorgulamak için. */
export const affectionEmojiRegex: RegExp = /❤️|❤|💕|💖|💗|💞|💓|🤍|🥰|😍|😘|😚|😙|💋/u;
export const humorEmojiRegex: RegExp = /😂|🤣|😅|😆|🥲|🤭|😹/u;
export const sarcasmEmojiRegex: RegExp = /🙄|😒/u;
export const angerEmojiRegex: RegExp = /😡|🤬/u;
export const sadnessEmojiRegex: RegExp = /😢|😭|🥺/u;
