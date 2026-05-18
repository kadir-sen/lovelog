// Ritüel mesajlar — phrase mining'de yüksek frekanslı, saat-bağımlı.
// "iyi geceler" 210/210 gece, "günaydın" 72/80 sabah → aynı söz farklı
// saatte farklı pragma taşıyabilir; ritualMessageClassifier saatle
// birleştirerek confidence kalibre eder.

export type RitualKind =
  | 'good_night'
  | 'good_morning'
  | 'sweet_dreams'
  | 'easy_does_it'
  | 'safe_travels'
  | 'kisses_signoff'
  | 'see_you_signoff';

export type RitualExpectedWindow = 'night' | 'morning' | 'day' | 'any';

export interface LearnedRitualPhrase {
  kind: RitualKind;
  pattern: RegExp;
  expectedWindow: RitualExpectedWindow;
  /** Beklenen pencerede confidence değeri. */
  warmthInWindow: number;
  /** Beklenen pencere dışında confidence değeri (genelde daha düşük). */
  warmthOutOfWindow: number;
}

export const RITUAL_WINDOWS = {
  night:   { startHour: 21, endHour: 5 },   // 21:00-04:59
  morning: { startHour: 5,  endHour: 11 },  // 05:00-10:59
  day:     { startHour: 11, endHour: 21 },  // 11:00-20:59
} as const;

export const ritualWindowFor = (hour: number): 'night' | 'morning' | 'day' => {
  if (hour >= 21 || hour < 5) return 'night';
  if (hour >= 5 && hour < 11) return 'morning';
  return 'day';
};

// Türkçe-aware sınır (ASCII \b ı/ş üzerinde patlar).
const O = '(?<![\\p{L}\\p{M}])';
const C = '(?![\\p{L}\\p{M}])';

export const learnedRitualPhrases: readonly LearnedRitualPhrase[] = [
  {
    kind: 'good_night',
    pattern: new RegExp(`${O}iyi\\s+gece(?:ler)?${C}`, 'iu'),
    expectedWindow: 'night',
    warmthInWindow: 0.75,
    warmthOutOfWindow: 0.4,
  },
  {
    kind: 'good_morning',
    pattern: new RegExp(`${O}g[üu]nayd[ıi]n${C}`, 'iu'),
    expectedWindow: 'morning',
    warmthInWindow: 0.75,
    warmthOutOfWindow: 0.4,
  },
  {
    kind: 'sweet_dreams',
    pattern: new RegExp(`${O}tatl[ıi]\\s+r[üu]yalar${C}`, 'iu'),
    expectedWindow: 'night',
    warmthInWindow: 0.8,
    warmthOutOfWindow: 0.45,
  },
  {
    kind: 'easy_does_it',
    pattern: new RegExp(`${O}kolay\\s+gels[ıi]n${C}`, 'iu'),
    expectedWindow: 'day',
    warmthInWindow: 0.55,
    warmthOutOfWindow: 0.5, // tüm gün makul
  },
  {
    kind: 'safe_travels',
    pattern: new RegExp(`${O}iyi\\s+yolculuklar?${C}`, 'iu'),
    expectedWindow: 'any',
    warmthInWindow: 0.55,
    warmthOutOfWindow: 0.55,
  },
  {
    kind: 'kisses_signoff',
    pattern: new RegExp(`${O}[öo]p[üu]c[üu]kler?${C}`, 'iu'),
    expectedWindow: 'night',
    warmthInWindow: 0.65,
    warmthOutOfWindow: 0.55,
  },
  {
    kind: 'see_you_signoff',
    pattern: new RegExp(`${O}g[öo]r[üu][şs][üu]r[üu]z${C}`, 'iu'),
    expectedWindow: 'any',
    warmthInWindow: 0.45,
    warmthOutOfWindow: 0.45,
  },
];

// Birleşik regex — toplu tarama için (en az bir kategori eşleşiyor mu kontrolü).
export const ritualPhraseFamilyRegex: RegExp = new RegExp(
  learnedRitualPhrases.map(r => `(?:${r.pattern.source})`).join('|'),
  'iu'
);

/** Bir text'i tek-pas tarayıp eşleşen ritualları döndürür. */
export const findRitualMatches = (text: string): LearnedRitualPhrase[] => {
  if (!text) return [];
  return learnedRitualPhrases.filter(r => r.pattern.test(text));
};
