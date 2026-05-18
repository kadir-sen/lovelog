// Türkçe ilişki dili sıcak hitap terimleri. Annotation pipeline'ından (A ve B
// yazarlarının ortak frekansı) doğrulanmış; tüm WhatsApp sohbetlerinde yaygın.
// Sadece genelleştirilmiş terimleri içerir, hiçbir özel kişiye özgü terim yoktur.

export const learnedWarmTerms: readonly string[] = [
  'aşkım',
  'sevgilim',
  'hayatım',
  'bitanem',
  'canım',
  'tatlım',
  'bebeğim',
  'güzelim',
  'kalbim',
  'meleğim',
  'prensesim',
  'çiçeğim',
  'yavrum',
  'iyi ki varsın',
] as const;

/**
 * "Playful insult" — yakın ilişkide sevgi-yumuşatmasıyla kullanılan, içinde
 * argo geçen ama düşman olmayan ifadeler. Confidence damper'ı için ipucu.
 * "salak" / "aptal" bunlar playful da olabilir, sert de — bağlam karar verir.
 */
export const learnedPlayfulInsults: readonly string[] = [
  'salak',
  'mal',
  'aptal',
  'deli',
  'çatlak',
] as const;

/**
 * PR-1: frekans-aware warm term ağırlıkları. Mevcut flat liste dokunulmadan
 * paralel olarak ihraç edilir; intensifierDragClassifier ve emojiClusterClassifier
 * bu ağırlıkları confidence boost'u olarak okur.
 *
 * dragFriendly = true → bu term'in "term + mmm" varyantı yaygın (annotation
 * pipeline mining'inde gözlendi).
 */
export interface WarmTermWeight {
  term: string;
  /** 0..1 — daha yüksek = daha güçlü warmth sinyali. */
  weight: number;
  /** drag-friendly mi (intensifierDragClassifier için). */
  dragFriendly: boolean;
}

export const learnedWarmTermWeights: readonly WarmTermWeight[] = [
  { term: 'aşkım', weight: 1.0, dragFriendly: true },
  { term: 'bitanem', weight: 0.95, dragFriendly: true },
  { term: 'sevgilim', weight: 0.9, dragFriendly: true },
  { term: 'hayatım', weight: 0.9, dragFriendly: true },
  { term: 'karım', weight: 0.85, dragFriendly: true },
  { term: 'kocam', weight: 0.85, dragFriendly: true },
  { term: 'tatlım', weight: 0.7, dragFriendly: false },
  { term: 'bebeğim', weight: 0.7, dragFriendly: false },
  { term: 'canım', weight: 0.7, dragFriendly: false },
  { term: 'güzelim', weight: 0.7, dragFriendly: false },
  { term: 'kalbim', weight: 0.75, dragFriendly: false },
  { term: 'meleğim', weight: 0.7, dragFriendly: false },
  { term: 'çiçeğim', weight: 0.65, dragFriendly: false },
  { term: 'iyi ki varsın', weight: 0.8, dragFriendly: false },
] as const;
