// Türkçe metin için kelime-sınırı duyarlı eşleşme, basit ek listesi,
// negasyon ve gülme tespiti — şaka/sarkazm-farkında NLP MVP'sinin temel taşları.

const SUFFIX_GROUP =
  '(?:ım|im|um|üm|ın|in|un|ün|sın|sin|sun|sün|dı|di|du|dü|tı|ti|tu|tü|ydı|ydi|ydu|ydü|yor|muş|mış|müş|mus|lar|ler|da|de|ta|te|dan|den|tan|ten|nın|nin|nun|nün|na|ne|ya|ye|yı|yi|yu|yü|yla|yle|si|su|sü|ki|a|e|ı|i|u|ü)?';

// Bazı kısa keyword'ler ('mal', 'sus' gibi) ek aldığında yanlış pozitif
// üretebilir. Bunları opsiyonel ekten muaf tutuyoruz; sadece tam kelime
// eşleşmesi.
const NO_SUFFIX_KEYWORDS = new Set(['mal', 'sus', 'bal']);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordPattern(keyword: string): string {
  const escaped = escapeRegex(keyword);
  if (NO_SUFFIX_KEYWORDS.has(keyword) || keyword.includes(' ')) {
    return escaped;
  }
  return `${escaped}${SUFFIX_GROUP}`;
}

export function buildKeywordRegex(keywords: string[]): RegExp {
  if (!keywords.length) return /(?!)/;
  const alternation = keywords.map(keywordPattern).join('|');
  return new RegExp(
    `(?<![\\p{L}\\p{M}])(?:${alternation})(?![\\p{L}\\p{M}])`,
    'giu'
  );
}

export function matchKeywordCount(text: string, regex: RegExp): number {
  if (!text) return 0;
  regex.lastIndex = 0;
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

const SENTENCE_BREAK = /(?<=[.!?…])\s+/u;

export function splitClauses(text: string): string[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed
    .split(SENTENCE_BREAK)
    .map(part => part.trim())
    .filter(Boolean);
}

const NEGATION_REGEX =
  /(?<![\p{L}\p{M}])(?:değil(?:im|sin|iz|ler)?|yok|asla|hiç|sevm(?:iyor(?:um|sun)?|edim|em|ezsin)|etm(?:iyor(?:um|sun)?|edim|em)|istemi(?:yor(?:um|sun)?|yorum)|olmaz|olmadı)(?![\p{L}\p{M}])/iu;

export function hasNegation(text: string): boolean {
  if (!text) return false;
  return NEGATION_REGEX.test(text);
}

const LAUGH_REGEX =
  /😂|🤣|😆|🥲|😹|🤭|🥹|h(?:[aeı]h){1,}[aeı]?|h[aeı]{2,}|k[ks]{3,}|gülmekten|gülüyorum|öldüm gülm|amk gülüy/iu;

export function hasLaugh(text: string): boolean {
  if (!text) return false;
  return LAUGH_REGEX.test(text);
}

const SLANG_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bnbr\b/giu, 'ne haber'],
  [/\bnab[eı]r\b/giu, 'ne haber'],
  [/\bnap[ıi]yorsun\b|\bnapiyosun\b|\bnap[ıi]yon\b|\bnap[ıi]on\b|\bnap[ıi]yosun\b/giu, 'ne yapıyorsun'],
  [/\btmm\b|\btm\b|\bokey\b|\bok\b/giu, 'tamam'],
  [/\bgrsrz\b|\bgr[şs]rz\b/giu, 'görüşürüz'],
  [/\bcnm\b/giu, 'canım'],
  [/\baskm\b|\ba[şs]km\b/giu, 'aşkım'],
  [/\bbisi\b|\bbi[şs]i\b|\bbi [şs]ey\b/giu, 'bir şey'],
  [/\bslm\b/giu, 'selam'],
  [/\bmrb\b/giu, 'merhaba'],
  [/\bii\b/giu, 'iyi'],
  [/\bdeil\b|\bdiil\b/giu, 'değil'],
  [/\byaaa+\b/giu, 'ya'],
];

export interface NormalizedTurkishText {
  text: string;
  intensityMultiplier: number;
  replacements: string[];
}

export function normalizeRepeatedCharacters(text: string): NormalizedTurkishText {
  const replacements: string[] = [];
  let intensityMultiplier = 1;
  const normalized = text.replace(/([\p{L}])\1{2,}/giu, match => {
    intensityMultiplier += Math.min(1.5, (match.length - 2) * 0.25);
    replacements.push(match);
    return match.slice(0, 2);
  });
  return { text: normalized, intensityMultiplier, replacements };
}

export function normalizeTurkishSlang(text: string): NormalizedTurkishText {
  const repeated = normalizeRepeatedCharacters(text);
  let normalized = repeated.text;
  const replacements = [...repeated.replacements];
  SLANG_REPLACEMENTS.forEach(([regex, replacement]) => {
    if (regex.test(normalized)) {
      replacements.push(replacement);
      normalized = normalized.replace(regex, replacement);
    }
    regex.lastIndex = 0;
  });
  return {
    text: normalized.replace(/\s+/g, ' ').trim(),
    intensityMultiplier: repeated.intensityMultiplier,
    replacements,
  };
}

export type EmojiSemantic =
  | 'affection'
  | 'flirt'
  | 'humor'
  | 'contempt'
  | 'sadness'
  | 'anger'
  | 'suspicion';

const EMOJI_MAP: Array<[RegExp, EmojiSemantic[]]> = [
  [/❤️|❤|💕|💖|😍|🥰|😘|💋/u, ['affection', 'flirt']],
  [/😂|🤣|😅|😆|🤭/u, ['humor']],
  [/😒|🙄/u, ['contempt']],
  [/😢|😭|🥺/u, ['sadness']],
  [/😡|🤬/u, ['anger']],
  [/👀/u, ['suspicion']],
];

export function mapEmojiSemantics(text: string): EmojiSemantic[] {
  const tags = new Set<EmojiSemantic>();
  EMOJI_MAP.forEach(([regex, semantics]) => {
    if (regex.test(text)) semantics.forEach(s => tags.add(s));
  });
  return Array.from(tags);
}

export function detectQuestion(text: string): boolean {
  return /\?|\b(?:mi|mı|mu|mü|neden|niye|kim|kiminle|nerede|nerdesin|ne zaman|nasıl|kaçta|hangi)\b/iu.test(text);
}

export function maskSensitiveText(text: string, max = 220): string {
  const clean = text
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[email]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[telefon]')
    .replace(/\b(?:mah\.?|mahalle|cad\.?|cadde|sok\.?|sokak|apt\.?|no:?)\s+[\p{L}\p{N}\s./-]{3,}/giu, '[adres]')
    .replace(/\b\d{4,}\b/g, '[sayı]')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
