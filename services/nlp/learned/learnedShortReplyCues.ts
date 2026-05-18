// Short-reply ayrımları (warm / neutral / cold) için öğrenilmiş paternler.
// Annotation pipeline raporlarındaki phrase mining'den türetilmiştir.

/** "Bare" nötr ack: prev context'ten bağımsız okunduğunda nötrdür. */
export const learnedNeutralAckBare: readonly string[] = [
  'tamam',
  'tamamdır',
  'tamamm',
  'ok',
  'okey',
  'olur',
  'peki',
  'anladım',
  'oldu',
  'tmm',
] as const;

/** Soğuk ack işaretleri — düz nokta, "neyse", "boşver"... */
export const learnedColdAckCues: readonly string[] = [
  'tamam.',
  'peki.',
  'ok.',
  'anladım.',
  'neyse',
  'boşver',
  'boş ver',
  'sen bilirsin',
  'fark etmez',
  'ne diyim',
  'önemli değil',
] as const;

/** Pasif-agresif kalıplar — gülen yüz + nötr ack tehlikeli kombinasyondur. */
export const learnedPassiveAggressiveCues: readonly string[] = [
  'peki :)',
  'tamam :)',
  'sen bilirsin :)',
  'sorun değil :)',
  'önemli değil :)',
  'aynen aynen',
  'aynen öyledir',
  'nasıl istersen',
  'ne diyim ki',
] as const;

/** Açıkça withdrawal: "şimdi konuşmak istemiyorum", "sonra" */
export const learnedWithdrawalCues: readonly string[] = [
  'şimdi konuşmak istemiyorum',
  'konuşmak istemiyorum',
  'sonra konuşuruz',
  'şu an olmaz',
  'şimdi olmaz',
  'kapatalım konuyu',
  'bırak şimdi',
  'uzatma',
] as const;

/** Conflict-shutdown: "bitti konu", "yazma bana" */
export const learnedConflictShutdownCues: readonly string[] = [
  'konuşmuyorum artık',
  'bitti konu',
  'cevap vermeyeceğim',
  'yazma bana',
  'kapatalım',
  'kapat konuyu',
] as const;

/** Topic-shift yumuşatıcı: "neyse" + yeni konu açma. */
export const learnedTopicShiftCues: readonly string[] = [
  'neyse',
  'konuyu kapatalım',
  'başka şey',
  'boş ver',
  'geçelim',
] as const;

/** Kısa cevap için max sözcük/karakter eşiği (analytics.ts ile uyumlu). */
export const learnedShortReplyMaxWords = 3;
export const learnedShortReplyMaxChars = 25;
