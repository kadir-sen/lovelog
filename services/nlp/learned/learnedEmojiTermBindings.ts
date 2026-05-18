// Aşk sözcüğü × emoji bağlanmaları — phrase mining co-occurrence çıktısı.
// "aşkım × 🐬" (11 kez) gibi paternler bu çiftin "özel marker"larını
// yakalar. emojiClusterClassifier bu bağlanmaları "inside_joke_pattern"
// tag'ine yükseltmek için kullanır.

export type AffectionTerm =
  | 'aşkım' | 'hayatım' | 'sevgilim' | 'bitanem'
  | 'canım' | 'tatlım' | 'bebeğim';

export interface EmojiTermBinding {
  term: AffectionTerm;
  /** En sık birlikte gözlenen emojiler (jenerik, top-N). */
  emojis: string[];
  /** standard = jenerik affection emoji, custom = couple-spesifik marker. */
  bindingStrength: 'standard' | 'custom';
}

export const learnedEmojiTermBindings: readonly EmojiTermBinding[] = [
  // Custom bindings — annotation pipeline'ından gözlemlenen pattern.
  // 🐬 jenerik semantikte affection değil; bu bağlama "inside_joke_pattern"
  // tag'ini tetikler.
  { term: 'aşkım',   emojis: ['🐬', '🥵', '🤓', '🥹', '🐰'], bindingStrength: 'custom' },
  { term: 'hayatım', emojis: ['🐬'], bindingStrength: 'custom' },
  // Standard bindings — jenerik beklenen affection emoji eşlemeleri.
  { term: 'aşkım',   emojis: ['😘', '❤️', '😚'], bindingStrength: 'standard' },
  { term: 'bitanem', emojis: ['😘', '😙'],       bindingStrength: 'standard' },
  { term: 'sevgilim', emojis: ['😘'],            bindingStrength: 'standard' },
  { term: 'canım',   emojis: ['😘', '🥰'],       bindingStrength: 'standard' },
];

/** Bir mesajda warm-term + custom emoji eşleşmesi var mı? */
export const findCustomBinding = (
  text: string,
  emojis: string[]
): { term: AffectionTerm; emoji: string } | null => {
  if (!text || !emojis.length) return null;
  const tlc = text.toLocaleLowerCase('tr-TR');
  for (const b of learnedEmojiTermBindings) {
    if (b.bindingStrength !== 'custom') continue;
    if (!tlc.includes(b.term)) continue;
    for (const e of b.emojis) {
      if (emojis.includes(e)) return { term: b.term, emoji: e };
    }
  }
  return null;
};
