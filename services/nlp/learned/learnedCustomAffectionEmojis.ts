// Sohbet özelinde "affection marker" haline gelmiş ama JENERİK semantikte
// affection olmayan emojiler. learnedEmojiSemantics.ts'i değiştirmek yerine
// bu liste ek-layer olarak emojiClusterClassifier ve styleProfile tarafından
// okunur.

export const learnedCustomAffectionEmojis: readonly string[] = [
  '🐬', '🐰', '🥵', '🤓', '🥹', '🥸', '🫡',
] as const;

// Alternation regex'i — birleşik tarama için. Codepoint farklılıklarını
// (variation selector vs.) hesaba katmaz; runtime'da `text.includes(e)`
// kontrolü ile birlikte kullanılır.
export const customAffectionEmojiRegex: RegExp = new RegExp(
  learnedCustomAffectionEmojis.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'u'
);
