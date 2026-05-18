// Care / check-in paternleri — phrase mining'de A ve B yazarlarında en sık
// görülen care 2-gram'ları: "iyi misin", "müsait misin", "yorgun musun",
// "günün nasıl(dı)", "nasıl geçti".
// Bu lexicon control_pressure ile çakışma durumunda ayrımı sağlar:
//  - care_checkin: yalnızca soru tonu, baskı/emir yok.
//  - control_pressure: care + tekrar/baskı/agresyon → diğer classifier.

export const learnedCareCheckinCues: readonly string[] = [
  'iyi misin',
  'müsait misin',
  'yorgun musun',
  'günün nasıl',
  'günün nasıldı',
  'nasıl geçti',
  'nasıl geçiyor',
  'eve vardın mı',
  'sağ salim vardın mı',
  'rahat mısın',
  'uyudun mu',
  'uyandın mı',
  'yemek yedin mi',
  'kendine iyi bak',
] as const;

// Türkçe-aware sınır: ASCII \b ı/ş/ğ üzerinde patladığı için Unicode lookaround.
const O = '(?<![\\p{L}\\p{M}])';
const C = '(?![\\p{L}\\p{M}])';

export const learnedCareCheckinPatterns: readonly RegExp[] = [
  new RegExp(`${O}iyi +misin${C}`, 'iu'),
  new RegExp(`${O}m[üu]sait +misin${C}`, 'iu'),
  new RegExp(`${O}yorgun +musun${C}`, 'iu'),
  new RegExp(`${O}g[üu]n[üu]n +nas[ıi]l(?:d[ıi])?${C}`, 'iu'),
  new RegExp(`${O}nas[ıi]l +ge[çc]ti${C}`, 'iu'),
  new RegExp(`${O}eve +vard[ıi]n +m[ıi]${C}`, 'iu'),
  new RegExp(`${O}sa[ğg] +sal[ıi]m${C}`, 'iu'),
  new RegExp(`${O}rahat +m[ıi]s[ıi]n${C}`, 'iu'),
  new RegExp(`${O}uyudu[nm]+ +m[ıi]${C}`, 'iu'),
  new RegExp(`${O}uyand[ıi]n +m[ıi]${C}`, 'iu'),
  new RegExp(`${O}yemek +yedi[mn] +m[ıi]${C}`, 'iu'),
  new RegExp(`${O}kendine +iyi +bak${C}`, 'iu'),
];

/** "nerdesin / neredesin" — tek başına care olabilir; care_checkin
 *  classifier'ı bunu DİĞER sinyallerle (emir tonu, tekrar) çakıştırarak karar verir. */
export const learnedAmbiguousLocationQuery: readonly RegExp[] = [
  new RegExp(`${O}nerede(?:sin)?${C}`, 'iu'),
  new RegExp(`${O}nerdesin${C}`, 'iu'),
  new RegExp(`${O}neredesin${C}`, 'iu'),
];
