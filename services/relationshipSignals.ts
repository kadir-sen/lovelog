import {
  MessageInsight,
  MessageSignal,
  MessageSignalDetail,
  NormalizedMessage,
  RelationshipSignalKey,
} from '../types';
import {
  buildKeywordRegex,
  detectQuestion,
  hasLaugh,
  hasNegation,
  mapEmojiSemantics,
  maskSensitiveText,
  matchKeywordCount,
  normalizeTurkishSlang,
} from './turkishLemma';

const SIGNAL_KEYS: RelationshipSignalKey[] = [
  'affection', 'longing', 'emotionalOpenness', 'reassurance', 'insecurity', 'jealousy',
  'control', 'avoidance', 'withdrawal', 'criticism', 'contempt', 'defensiveness',
  'stonewalling', 'apology', 'accountability', 'blameShifting', 'repairAttempt',
  'planning', 'cancellation', 'futureTalk', 'sexualOrRomanticIntimacy',
  'boundarySetting', 'boundaryViolation', 'humor', 'sarcasm', 'harshLanguage',
  'manipulationLike',
];

const LEXICONS: Record<RelationshipSignalKey, string[]> = {
  affection: ['aşkım', 'sevgilim', 'canım', 'seni seviyorum', 'seviyorum', 'tatlım', 'bitanem', 'güzelim', 'yakışıklım', 'iyi ki varsın'],
  longing: ['özledim', 'çok özledim', 'keşke burada olsan', 'görmek istiyorum', 'hasret', 'yanımda ol'],
  emotionalOpenness: ['kırıldım', 'üzüldüm', 'mutlu oldum', 'hissediyorum', 'içim', 'ağladım', 'korkuyorum', 'yalnız hissediyorum'],
  reassurance: ['merak etme', 'yanındayım', 'buradayım', 'seni bırakmam', 'güven bana', 'hallederiz', 'geçecek'],
  insecurity: ['beni sevmiyor musun', 'bırakacak mısın', 'terk mi', 'soğudun mu', 'istemiyor musun', 'değerim yok'],
  jealousy: ['kıskandım', 'kıskanç', 'kim o', 'kiminle', 'neden yazdı', 'onu mu', 'eski sevgilin'],
  control: ['konum at', 'neredesin', 'kimleydin', 'takipten çık', 'onunla konuşma', 'şunu giyme', 'hesap ver', 'foto at'],
  avoidance: ['sonra konuşuruz', 'boş ver', 'şimdi değil', 'uzatma', 'konuşmak istemiyorum', 'geçelim', 'neyse'],
  withdrawal: ['tamam', 'ok', 'peki', 'iyi', 'bilmiyorum', 'fark etmez', 'ne diyeyim'],
  criticism: ['hep böylesin', 'hiç düşünmüyorsun', 'umursamıyorsun', 'çocuksun', 'sorumsuzsun', 'bencilsin'],
  contempt: ['abartıyorsun', 'drama yapıyorsun', 'sen anlamazsın', 'komiksin', 'saçmalıyorsun', 'boş yapma', 'ezik'],
  defensiveness: ['ben öyle demedim', 'benim suçum değil', 'sen de', 'asıl sen', 'yine bana kaldı', 'ne var bunda'],
  stonewalling: ['cevap vermeyeceğim', 'konuşmuyorum', 'yazma', 'sus', 'bitti konu', 'kapatalım'],
  apology: ['özür', 'pardon', 'kusura bakma', 'affet', 'üzgünüm'],
  accountability: ['haklısın', 'hata yaptım', 'seni kırdım', 'benim hatam', 'sorumluluk alıyorum', 'düzelteceğim'],
  blameShifting: ['senin yüzünden', 'beni buna sen ittirdin', 'sen yaptırdın', 'asıl suçlu sensin', 'sen başlattın'],
  repairAttempt: ['konuşup çözelim', 'düzeltmek istiyorum', 'barışalım', 'telafi edeyim', 'orta yol', 'sakin konuşalım'],
  planning: ['buluşalım', 'gidelim', 'yapalım', 'plan', 'rezervasyon', 'yarın görüşelim', 'saat kaç'],
  cancellation: ['iptal', 'erteleyelim', 'gelemiyorum', 'gelemem', 'yapamayacağım', 'müsait değilim', 'olmuyor'],
  futureTalk: ['ileride', 'bir gün', 'yapacağız', 'gideceğiz', 'evlen', 'tatil yaparız', 'gelecekte'],
  sexualOrRomanticIntimacy: ['öpmek', 'sarılmak', 'dudak', 'yatağa', 'tenin', 'romantik', 'ateşli'],
  boundarySetting: ['istemiyorum', 'buna sınır koyuyorum', 'böyle konuşma', 'rahatsız oluyorum', 'bana bunu yapma'],
  boundaryViolation: ['abartma', 'mecbursun', 'yapacaksın', 'izin vermem', 'hayır deme', 'zorundasın'],
  humor: ['şaka', 'komik', 'güldüm', 'kahkaha'],
  sarcasm: ['aynen kesin', 'tabii canım', 'bravo', 'harikasın gerçekten'],
  harshLanguage: ['aptal', 'salak', 'mal', 'nefret', 'defol', 'siktir', 'lanet', 'yalancı'],
  manipulationLike: ['uyduruyorsun', 'öyle bir şey olmadı', 'çok hassassın', 'senin yüzünden', 'bunu bana nasıl yaparsın', 'ben zaten kötüyüm'],
};

const REGEXES = Object.fromEntries(
  SIGNAL_KEYS.map(key => [key, buildKeywordRegex(LEXICONS[key])])
) as Record<RelationshipSignalKey, RegExp>;

const emptyDetail = (): MessageSignalDetail => ({
  count: 0,
  score: 0,
  evidenceTerms: [],
  negated: false,
  playfulDampened: false,
});

const emptySignals = (): MessageSignal =>
  Object.fromEntries(SIGNAL_KEYS.map(key => [key, emptyDetail()])) as MessageSignal;

const collectTerms = (text: string, key: RelationshipSignalKey): string[] =>
  LEXICONS[key].filter(term => text.includes(term)).slice(0, 4);

const addEmojiSignals = (signals: MessageSignal, text: string): void => {
  const semantics = mapEmojiSemantics(text);
  semantics.forEach(tag => {
    if (tag === 'affection' || tag === 'flirt') {
      signals.affection.count += 1;
      signals.affection.score += 1;
      signals.affection.evidenceTerms.push('emoji:affection');
    }
    if (tag === 'humor') {
      signals.humor.count += 1;
      signals.humor.score += 1;
      signals.humor.evidenceTerms.push('emoji:humor');
    }
    if (tag === 'contempt') {
      signals.contempt.count += 1;
      signals.contempt.score += 0.7;
      signals.contempt.evidenceTerms.push('emoji:annoyance');
    }
    if (tag === 'anger') {
      signals.harshLanguage.count += 1;
      signals.harshLanguage.score += 1;
      signals.harshLanguage.evidenceTerms.push('emoji:anger');
    }
  });
};

export const extractRelationshipSignals = (
  message: NormalizedMessage,
  previousMessage?: NormalizedMessage
): MessageInsight => {
  const normalized = normalizeTurkishSlang(message.content || '');
  const normalizedText = normalized.text.toLocaleLowerCase('tr-TR');
  const negated = hasNegation(normalizedText);
  const playful = hasLaugh(message.content) || !!previousMessage?.playfulnessFlag;
  const signals = emptySignals();

  SIGNAL_KEYS.forEach(key => {
    const count = matchKeywordCount(normalizedText, REGEXES[key]);
    if (!count) return;
    const dampenByNegation = negated && ['affection', 'longing', 'planning', 'futureTalk', 'harshLanguage'].includes(key);
    const dampenByPlay = playful && ['criticism', 'contempt', 'harshLanguage'].includes(key);
    const multiplier = dampenByNegation ? 0 : dampenByPlay ? 0.35 : normalized.intensityMultiplier;
    signals[key] = {
      count,
      score: Number((count * multiplier).toFixed(2)),
      evidenceTerms: collectTerms(normalizedText, key),
      negated: dampenByNegation,
      playfulDampened: dampenByPlay,
    };
  });
  addEmojiSignals(signals, message.content);

  if (message.isShortReply && previousMessage && previousMessage.author !== message.author && previousMessage.wordCount > 8) {
    signals.withdrawal.count += 1;
    signals.withdrawal.score += 0.8;
    signals.withdrawal.evidenceTerms.push('kısa cevap');
  }
  if (detectQuestion(normalizedText) && /nerede|nerdesin|kimle|konum|neden geç/iu.test(normalizedText)) {
    signals.control.score += 0.6;
    signals.jealousy.score += 0.5;
  }

  const warmthScore = signals.affection.score + signals.longing.score + signals.reassurance.score + signals.futureTalk.score * 0.5;
  const conflictScore = signals.criticism.score + signals.contempt.score + signals.defensiveness.score + signals.harshLanguage.score + signals.blameShifting.score + signals.manipulationLike.score;
  const avoidanceScore = signals.avoidance.score + signals.withdrawal.score + signals.stonewalling.score;
  const controlScore = signals.control.score + signals.jealousy.score + signals.boundaryViolation.score;
  const repairScore = signals.apology.score + signals.accountability.score + signals.repairAttempt.score;

  return {
    messageId: String(message.id),
    speaker: message.author,
    normalizedSpeaker: 'other',
    timestamp: message.date.toISOString(),
    dateKey: message.dateKey,
    textMasked: maskSensitiveText(message.content),
    signals,
    dialogueActs: [],
    emotionalValence: Number(((warmthScore + repairScore * 0.5) - (conflictScore + avoidanceScore * 0.5 + controlScore * 0.4)).toFixed(2)),
    conflictScore: Number(conflictScore.toFixed(2)),
    warmthScore: Number(warmthScore.toFixed(2)),
    avoidanceScore: Number(avoidanceScore.toFixed(2)),
    controlScore: Number(controlScore.toFixed(2)),
    repairScore: Number(repairScore.toFixed(2)),
    isShortReply: message.isShortReply,
    hasQuestion: message.hasQuestion || detectQuestion(normalizedText),
  };
};
