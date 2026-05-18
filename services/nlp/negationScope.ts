// services/nlp/negationScope.ts — clause-scope negation.
// turkishLemma.hasNegation tek bir mesajda negation OLUP OLMADIĞINI söyler;
// burada her CLAUSE ayrı ayrı kontrol edilir, ek olarak negation'ın hangi
// kategorileri etkilediği (affection / harsh / planning) raporlanır.

import { hasNegation, splitClauses } from '../turkishLemma';

export interface NegationScope {
  /** Toplam clause sayısı. */
  totalClauses: number;
  /** Negation içeren clause sayısı. */
  negatedClauses: number;
  /** Hangi clause'lar negation taşıyor (0-indexed). */
  negatedIndices: number[];
  /** "sevmiyorum" vb. — affection lexicon'unun aynı clause'da negate edildiği bilgisi. */
  affectionNegated: boolean;
  /** "nefret etmiyorum" / "kızmadım" — harsh/anger lexicon'unun negate edildiği bilgisi. */
  harshNegated: boolean;
  /** "gelemiyorum" / "yapamayacağım" — plan_cancel sinyali var mı. */
  planUnavailable: boolean;
  /** "istemiyorum artık" — boundary/withdrawal sinyali (clause-level). */
  refusalPresent: boolean;
}

// Türkçe-aware sınırlar: ASCII \b ı/ş/ğ üzerinde patlar; (?<![\p{L}\p{M}]) kullan.
const TB_OPEN = '(?<![\\p{L}\\p{M}])';
const TB_CLOSE = '(?![\\p{L}\\p{M}])';

const AFFECTION_TOKENS = new RegExp(
  `${TB_OPEN}(?:sev[\\p{L}]*|özl[\\p{L}]*|aşk[\\p{L}]*|tatl[ıi]m|hayat[ıi]m|bitanem|kalbim)${TB_CLOSE}`,
  'iu'
);
const HARSH_TOKENS = new RegExp(
  `${TB_OPEN}(?:nefret|k[ıi]z[\\p{L}]*|sinir[\\p{L}]*|ba[ğg][ıi]r[\\p{L}]*|öfke[\\p{L}]*|aptal|salak|mal|yalanc[ıi]|pislik)${TB_CLOSE}`,
  'iu'
);
const PLAN_UNAVAIL_TOKENS = new RegExp(
  `${TB_OPEN}(?:gelem[\\p{L}]*|gelemiyorum|gelemem|gelemeyece[ğg]im|yapama[\\p{L}]*|yapamam|olmuyor|olmayacak|m[üu]sait +de[ğg]il[\\p{L}]*|gelm[\\p{L}]+ +istemi[\\p{L}]*|olm[\\p{L}]+ +istemi[\\p{L}]*)${TB_CLOSE}`,
  'iu'
);
const REFUSAL_TOKENS = new RegExp(
  `${TB_OPEN}(?:istemi[\\p{L}]*|reddedi[\\p{L}]*|hayır +de[\\p{L}]+)${TB_CLOSE}`,
  'iu'
);

// Türkçe fiil-içi negation infix'leri: "-ma-/-me-" + zaman/şahıs,
// yani "kızmadım", "gelmedim", "yapmadım"...
// Ayrıca yetersizlik (-eme-/-ama-) → "gelemiyorum", "yapamayacağım", "olmuyor".
const TURKISH_VERB_NEGATION = new RegExp(
  `${TB_OPEN}[\\p{L}]{2,}(?:m[ae]d[ıiuü](?:[\\p{L}]*)?|m[ae]z(?:[\\p{L}]*)?|m[ae]y(?:e|a)cek(?:[\\p{L}]*)?|m[ae]m)${TB_CLOSE}`,
  'iu'
);
const TURKISH_INABILITY = new RegExp(
  `${TB_OPEN}[\\p{L}]{2,}(?:em(?:iyorum|iyorsun|edim|edin|em)|ama(?:yacağım|yacağız|d[ıi][nm]?|m)|am(?:[ıi]yor[\\p{L}]*)|emey(?:ecek|eceğim|eceğiz))${TB_CLOSE}`,
  'iu'
);
// "olmuyor" / "olmuyorum" / "olmayacak" — yardımcı kelime
const TURKISH_AUX_NEGATION = new RegExp(
  `${TB_OPEN}(?:olmuyor[\\p{L}]*|olmayacak|olmadı|olmaz)${TB_CLOSE}`,
  'iu'
);

const clauseHasNegation = (c: string): boolean =>
  hasNegation(c) ||
  TURKISH_VERB_NEGATION.test(c) ||
  TURKISH_INABILITY.test(c) ||
  TURKISH_AUX_NEGATION.test(c);

export const computeNegationScope = (text: string): NegationScope => {
  if (!text) {
    return {
      totalClauses: 0,
      negatedClauses: 0,
      negatedIndices: [],
      affectionNegated: false,
      harshNegated: false,
      planUnavailable: false,
      refusalPresent: false,
    };
  }

  const clauses = splitClauses(text);
  const negatedIndices: number[] = [];
  let affectionNegated = false;
  let harshNegated = false;
  let planUnavailable = false;
  let refusalPresent = false;

  clauses.forEach((c, idx) => {
    if (!clauseHasNegation(c)) return;
    negatedIndices.push(idx);
    if (AFFECTION_TOKENS.test(c)) affectionNegated = true;
    if (HARSH_TOKENS.test(c)) harshNegated = true;
    if (PLAN_UNAVAIL_TOKENS.test(c) || TURKISH_INABILITY.test(c) || TURKISH_AUX_NEGATION.test(c)) {
      planUnavailable = true;
    }
    if (REFUSAL_TOKENS.test(c)) refusalPresent = true;
  });

  return {
    totalClauses: clauses.length,
    negatedClauses: negatedIndices.length,
    negatedIndices,
    affectionNegated,
    harshNegated,
    planUnavailable,
    refusalPresent,
  };
};
