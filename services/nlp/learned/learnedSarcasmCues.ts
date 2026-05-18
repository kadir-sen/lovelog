// Annotation veri madenciliğinden öğrenilmiş sarcasm cue'ları.
// Türkçe sarcasm büyük çoğunlukla LITERAL POZİTİF + NEGATİF BAĞLAM şeklindedir.
// O yüzden çoğu cue tek başına yetersizdir; "requiresContext: true" işaretlenir.
//
// Tüm cue'lar context-boost koşullarıyla skor üretir:
//  - previous_conflict: prev penceresinde harsh/criticism/tension
//  - rolling_eyes:      🙄 / 😒
//  - cold_punctuation:  "tamam." / "peki." gibi düz noktalı kapanış
//  - intensifier_drag:  uzatılmış harf ("tabiii", "süpppersin")

export type SarcasmContextBoost =
  | 'previous_conflict'
  | 'rolling_eyes'
  | 'cold_punctuation'
  | 'intensifier_drag'
  | 'next_silence';

export interface LearnedSarcasmCue {
  label: string;
  pattern: RegExp;
  defaultConfidence: number;
  /** Context yoksa sarcasm denilemez. */
  requiresContext: boolean;
  contextBoosts: SarcasmContextBoost[];
}

export const learnedSarcasmCues: readonly LearnedSarcasmCue[] = [
  // "tabi canım" / "tabii canım" — yüksek frekanslı sarcasm cue. Düz olarak
  // samimi de olabilir, o yüzden context gerekir.
  {
    label: 'tabii canım',
    pattern: /\btab[ıi]+i? *can[ıi]m\b/iu,
    defaultConfidence: 0.55,
    requiresContext: true,
    contextBoosts: ['previous_conflict', 'rolling_eyes', 'cold_punctuation'],
  },
  // "bravo" — vocative ile geliyorsa daha güçlü. "bravo sana"
  {
    label: 'bravo',
    pattern: /\bbravo(?:\s+(?:sana|sa|sude|aşkım|ya))?\b/iu,
    defaultConfidence: 0.5,
    requiresContext: true,
    contextBoosts: ['previous_conflict', 'cold_punctuation'],
  },
  // "aynen kesin"
  {
    label: 'aynen kesin',
    pattern: /\baynen +kesin\b/iu,
    defaultConfidence: 0.55,
    requiresContext: true,
    contextBoosts: ['previous_conflict', 'rolling_eyes'],
  },
  // "harikasın gerçekten / süpersin ya"
  {
    label: 'harikasın gerçekten',
    pattern: /\bharikas[ıi]n +ger[çc]ekten\b|\bs[üu]pers[ıi]n +ya\b/iu,
    defaultConfidence: 0.55,
    requiresContext: true,
    contextBoosts: ['previous_conflict'],
  },
  // "süpppersin" / "harikaaa" — intensifier-drag tek başına sarcasm sinyali
  {
    label: 'intensifier-drag-pozitif',
    pattern: /\b(?:s[üu]p+e+r+s[ıi]n|harika+|m[üu]kemmel+s[ıi]n|inanılmaz+s[ıi]n)\b/iu,
    defaultConfidence: 0.4,
    requiresContext: true,
    contextBoosts: ['previous_conflict', 'rolling_eyes', 'intensifier_drag'],
  },
  // "aferin sana"
  {
    label: 'aferin sana',
    pattern: /\baferin +(?:sana|sude|sa)?\b/iu,
    defaultConfidence: 0.45,
    requiresContext: true,
    contextBoosts: ['previous_conflict', 'cold_punctuation'],
  },
  // "tabii ya" — opsiyonel
  {
    label: 'tabii ya',
    pattern: /\btab[ıi]+i? +ya\b/iu,
    defaultConfidence: 0.4,
    requiresContext: true,
    contextBoosts: ['previous_conflict', 'rolling_eyes'],
  },
  // "çok düşüncelisin / çok kibarsın" tarzı sarcasm
  {
    label: 'overly-praising',
    pattern: /\b[çc]ok +d[üu][şs][üu]ncelis[ıi]n\b|\b[çc]ok +kibars[ıi]n\b/iu,
    defaultConfidence: 0.5,
    requiresContext: true,
    contextBoosts: ['previous_conflict', 'rolling_eyes'],
  },
  // Rolling-eyes tek başına: emoji bazlı, prev context gerektirir.
  {
    label: 'rolling-eyes',
    pattern: /🙄|😒/u,
    defaultConfidence: 0.45,
    requiresContext: true,
    contextBoosts: ['previous_conflict', 'cold_punctuation'],
  },
] as const;

/** Sarcasm görüldüğünde warmth/affection'ı ne kadar dampen edeceğimiz. */
export const learnedSarcasmWarmthDampener = 0.4;
