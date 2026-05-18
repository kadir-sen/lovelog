// Türkçe intensifier-drag: warm-term/positive-adverb/neutral-filler üzerinde
// harf tekrarı ("aşkımmmm", "çokkkk", "tabiii"). Annotation pipeline'ında
// `çokkkk` (273), `aşkımmmm` (114), `bitanemmmm` (54), `sevgilimmmm` (48)
// gibi tokenlar gözlendi. Hangi BASE üzerinde drag olduğu anlamı belirler:
//   warm_term  → flört intensifier (intensified_endearment)
//   neutral_filler + prev conflict → sarcasm boost (sarcasmModifier üstlenir)
//   positive_adverb / expletive_soft → düşük signal

export type DragBase =
  | 'warm_term'
  | 'positive_adverb'
  | 'neutral_filler'
  | 'name_like'        // sözlükte olmayan ama drag içeren tokenlar (özel ad sızıntısını önlemek için kategori sayılır, span maskelenir)
  | 'expletive_soft';

export interface DragDetection {
  base: DragBase;
  /** Tekrar eden harf bloğunun uzunluğu (örn. "aşkımmmm" → 4). */
  repeatLen: number;
  /** Drag öncesi base token (jenerik). "aşkımmmm" → "aşkım". */
  baseToken: string;
  /** Orijinal eşleşen span — classifier-içi; evidence.ts maskeler. */
  span: string;
}

// Türkçe karakter desteği — \p{L} alphanum, \p{M} mark.
const TR_CHAR = '[\\p{L}\\p{M}]';

// Base token sözlüğü. Drag matcher'ı bunların üzerine harf tekrarını arar.
export const learnedDragBaseDictionary: Record<DragBase, readonly string[]> = {
  warm_term: [
    'aşkım', 'aşk', 'bitanem', 'sevgilim', 'hayatım', 'canım',
    'tatlım', 'bebeğim', 'güzelim', 'karım', 'kocam', 'kalbim',
  ],
  positive_adverb: ['çok', 'süper', 'harika', 'müthiş'],
  neutral_filler: ['tabi', 'tabii', 'hadi', 'yani', 'valla', 'bayağı', 'aynen', 'şey'],
  expletive_soft: ['off', 'offf', 'ay', 'oy', 'ouy', 'eyvah', 'aaa'],
  name_like: [], // dinamik kategori, sözlükte değil
};

// Drag tespiti: bir harfin 3+ ardışık tekrarı (`xxx`) — repo elsewhere
// için zaten REPEATED_CHAR_REGEX kullanılıyor; burada token-bazlı varyant.
const DRAG_TOKEN_REGEX = new RegExp(
  `${TR_CHAR}*?([\\p{L}])\\1{2,}${TR_CHAR}*`,
  'giu'
);

const stripDrag = (token: string): string =>
  // ardışık 3+ harfi 1'e indir: "aşkımmmm" → "aşkım", "tabiii" → "tabi"
  token.replace(/([\p{L}])\1{2,}/giu, '$1');

const matchedRepeatLen = (token: string): number => {
  const m = token.match(/([\p{L}])\1{2,}/u);
  return m ? m[0].length : 0;
};

const baseLookup = (stripped: string): DragBase => {
  const tlc = stripped.toLocaleLowerCase('tr-TR');
  for (const base of ['warm_term', 'positive_adverb', 'neutral_filler', 'expletive_soft'] as DragBase[]) {
    if (learnedDragBaseDictionary[base].some(b => tlc === b || tlc.startsWith(b))) {
      return base;
    }
  }
  return 'name_like';
};

/**
 * Mesajdaki tüm drag tokenlarını tespit eder ve kategorize eder.
 * name_like kategorisi özel ad sızıntısına karşı maskelenmiş span ile gelir.
 */
export const detectIntensifierDrag = (text: string): DragDetection[] => {
  if (!text) return [];
  const out: DragDetection[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(DRAG_TOKEN_REGEX)) {
    const span = m[0];
    if (seen.has(span)) continue;
    seen.add(span);
    const repeatLen = matchedRepeatLen(span);
    if (repeatLen < 3) continue;
    const baseToken = stripDrag(span);
    const base = baseLookup(baseToken);
    out.push({ base, repeatLen, baseToken, span });
  }
  return out;
};

export const hasWarmTermDrag = (text: string): boolean =>
  detectIntensifierDrag(text).some(d => d.base === 'warm_term');
