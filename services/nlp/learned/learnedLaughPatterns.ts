// Türkçe gülme/random pattern'leri. Annotation veri madenciliğinden
// öğrenilmiş; "kkk", "kkkk", "ahh", "ahhh", "heh", "hah", "kss"... gibi
// karakter-tekrarlı paternler hem A hem B yazarlarında baskın.
// Gülme tipi (real/softener/sarcastic) bağlama göre laughClassifier'da seçilir.

export interface LearnedLaughPattern {
  /** Etiket; debug/raporlama. */
  label: string;
  /** Eşleştirici. Word-boundary kullanır; çok kısa harf zincirlerinin gürültüsünü
   *  filtrelemek için minimum-uzunluk içerir. */
  pattern: RegExp;
  /** Ne kadar güçlü bir "gülüyor" sinyali. 0..1 */
  weight: number;
}

export const learnedLaughPatterns: readonly LearnedLaughPattern[] = [
  // Türkçe internet kahkahası: "kkk", "kkkk", "kksss", "ksk"
  { label: 'k-laugh', pattern: /\bk[ks]{2,}\b/iu, weight: 0.9 },
  // "ahh" / "ahhh" — uzatılmış nefes. Tek "ah" çoğunlukla iç çekiş, en az 3 harf gerek.
  { label: 'a-laugh',  pattern: /\bah[h]{1,}\b/iu, weight: 0.7 },
  // "heh" / "ehe" — küçük gülme
  { label: 'heh',      pattern: /\b(?:heh|ehe[he]*)\b/iu, weight: 0.55 },
  // Klasik "hahaha" / "ahaha"
  { label: 'hahaha',   pattern: /\b(?:ah?[aei][hk]){2,}[aei]?\b/iu, weight: 0.95 },
  // "asdsad" / "asdasd" — klavye-mash random
  { label: 'mash',     pattern: /\b(?:asd){2,}[aefsd]*\b/iu, weight: 0.6 },
  // "yhha" / "yhh" — Z-kuşağı gülme
  { label: 'yhh',      pattern: /\byhh[aei]*\b/iu, weight: 0.55 },
  // Emoji laugh (klasik)
  { label: 'emoji-laugh', pattern: /😂|🤣|😅|😆|🥲|😹/u, weight: 0.85 },
] as const;

// Birleştirilmiş regex — toplu tarama için kullanılır.
export const learnedLaughTokenRegex: RegExp = new RegExp(
  learnedLaughPatterns.map(p => `(?:${p.pattern.source})`).join('|'),
  'giu'
);

// Stilometri için baseline tokenlar
export const learnedLaughBaseTokens: readonly string[] = [
  'kkk', 'kkkk', 'kksss', 'ahh', 'ahhh', 'heh', 'hah', 'hahaha', 'asdsad', 'yhha',
] as const;

/** "Hakaret + gülme emojisi" pattern damper'ı için. */
export const learnedLaughDampenSeverity = 0.55;

/** Uzun gülme zinciri (kkkkkk veya hahahahahaha) — playful flag */
export const learnedExtendedLaughRegex: RegExp = /\b(?:k[ks]{4,}|ah?[aei][hk]ah?[aei][hk]ah?[aei]?)\b/iu;

/**
 * PR-1: token-uzunluğuna göre laugh weight kalibrasyonu.
 * "kkk" (3) base weight 0.9 → "kkkkkkkkk" (9) ≈ 0.97 (cap 1.0).
 * Mevcut imza/regex'ler değişmez; laughClassifier opt-in olarak kullanır.
 */
export const calibrateLaughWeight = (token: string, baseWeight: number): number => {
  const extra = Math.max(0, (token || '').length - 3);
  const bonus = Math.min(0.1, extra * 0.012);
  return Math.min(1.0, baseWeight + bonus);
};
