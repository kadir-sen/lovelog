// Control / pressure / jealousy paternleri. Annotation veri madenciliğinde
// "cevap ver", "kimle konuşuyorsun", "niye cevap" gibi 2-gram'lar sık çıktı.
// "neredesin" TEK BAŞINA control değildir; care context'i olmadığında
// (özellikle tekrar veya emir tonuyla) control'e döner.

export interface ControlCue {
  label: string;
  pattern: RegExp;
  /** Tek başına ne kadar güçlü. 0..1 */
  baseConfidence: number;
  /** Care context'i olduğunda baskılansın mı? */
  carePolite?: boolean;
}

export const learnedControlPressureCues: readonly string[] = [
  'konum at',
  'konumunu at',
  'ss at',
  'foto at',
  'kanıtla',
  'cevap versene',
  'hemen yaz',
  'hemen cevap ver',
  'kimle konuşuyorsun',
  'niye geç yazdın',
  'neden geç yazdın',
  'niye cevap vermedin',
  'cevap ver',
  'yanında kim var',
  'foto yolla',
] as const;

const O = '(?<![\\p{L}\\p{M}])';
const C = '(?![\\p{L}\\p{M}])';

export const learnedControlPressureCueObjects: readonly ControlCue[] = [
  { label: 'konum-at', pattern: new RegExp(`${O}konum(?:unu)? +at${C}`, 'iu'), baseConfidence: 0.8 },
  { label: 'ss-at', pattern: new RegExp(`${O}ss +at${C}`, 'iu'), baseConfidence: 0.75 },
  { label: 'foto-at', pattern: new RegExp(`${O}foto +(?:at|yolla)${C}`, 'iu'), baseConfidence: 0.7 },
  { label: 'kanitla', pattern: new RegExp(`${O}kan[ıi]tla${C}`, 'iu'), baseConfidence: 0.7 },
  { label: 'cevap-versene', pattern: new RegExp(`${O}cevap +versene${C}|${O}cevap +ver${C}(?:\\s*[.!]{1,3})?$`, 'iu'), baseConfidence: 0.55 },
  { label: 'hemen-yaz', pattern: new RegExp(`${O}hemen +(?:yaz|cevap +ver)${C}`, 'iu'), baseConfidence: 0.7 },
  { label: 'kimle-konusuyorsun', pattern: new RegExp(`${O}kimle +konu[şs]uyorsun${C}`, 'iu'), baseConfidence: 0.75 },
  { label: 'niye-gec-yazdin', pattern: new RegExp(`${O}(?:niye|neden) +(?:ge[çc] +yazd[ıi]n|cevap +vermedin)${C}`, 'iu'), baseConfidence: 0.65 },
  { label: 'yaninda-kim-var', pattern: new RegExp(`${O}yan[ıi]nda +kim +var${C}`, 'iu'), baseConfidence: 0.7 },
];

/** Jealousy-check pattern'leri — kıskançlık sorusu. */
export const learnedJealousyCheckCues: readonly RegExp[] = [
  new RegExp(`${O}kim +o${C}`, 'iu'),
  new RegExp(`${O}ki(?:m|me)l(?:e|isin|eydin|edin)${C}`, 'iu'),
  new RegExp(`${O}eski +sevgilin${C}`, 'iu'),
  new RegExp(`${O}onu +mu${C}`, 'iu'),
  new RegExp(`${O}niye +o(?:nu|na) +yazd[ıi]${C}`, 'iu'),
];

/**
 * "neredesin?" TEK BAŞINA control değildir. Bu lexicon care vs control ayrımı
 * için care_checkin tarafında ele alınır; controlPressureClassifier yalnızca
 * tekrar/emir/baskı tonu gördüğünde control işaretler.
 */
