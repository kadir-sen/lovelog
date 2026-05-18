// shortReplyClassifier — "tamam" sınıfı kısa cevapları context'e göre ayırır:
//   warm_ack | neutral_ack | cold_ack | conflict_shutdown | passive_aggressive_possible | topic_shift | withdrawal_possible

import type { ClassifierResult, ContextWindow } from './types';
import { prevConflictLevel, prevLastEmotionalLong, nextRepairOrWarmth } from './contextWindow';
import {
  learnedNeutralAckBare,
  learnedColdAckCues,
  learnedPassiveAggressiveCues,
  learnedWithdrawalCues,
  learnedConflictShutdownCues,
  learnedTopicShiftCues,
  learnedShortReplyMaxWords,
  learnedShortReplyMaxChars,
} from './learned/learnedShortReplyCues';
import { learnedWarmTerms } from './learned/learnedWarmTerms';
import { affectionEmojiRegex } from './learned/learnedEmojiSemantics';
import { learnedPhraseWeights } from './learned/learnedPhraseWeights';

const lc = (s: string): string => (s || '').toLocaleLowerCase('tr-TR');

const includesAny = (text: string, terms: readonly string[]): string[] => {
  const t = lc(text);
  return [...terms].filter(term => t.includes(term));
};

const evd = (
  span: string,
  reason: string,
  source: 'rule' | 'learned_pattern' | 'context' | 'punctuation' | 'emoji'
) => ({ span, reason, source });

export type ShortReplyTag =
  | 'warm_ack'
  | 'neutral_ack'
  | 'cold_ack'
  | 'conflict_shutdown'
  | 'passive_aggressive_possible'
  | 'withdrawal_possible'
  | 'topic_shift'
  | 'none';

export interface ShortReplyResult extends ClassifierResult {
  tag: ShortReplyTag;
}

const isBareAck = (text: string): boolean => {
  const t = lc(text).trim();
  const stripped = t.replace(/[.!?…\s]+$/g, '').trim();
  if (!stripped) return false;
  const words = stripped.split(/\s+/);
  if (words.length > learnedShortReplyMaxWords) return false;
  if (t.length > learnedShortReplyMaxChars) return false;
  // İlk kelime ack tokeni ise "bare ack" sayılır ("tamam", "tamam aşkım",
  // "ok canım"); warm/cold ayrımı sonraki adımlara bırakılır.
  return [...learnedNeutralAckBare].some(b => words[0] === b);
};

export const classifyShortReply = (ctx: ContextWindow): ShortReplyResult => {
  const m = ctx.target;
  const text = m.content || '';

  // Önce explicit "withdrawal" / "shutdown" / "passive aggressive" / "topic_shift" kalıpları.
  const wdHits = includesAny(text, learnedWithdrawalCues);
  if (wdHits.length) {
    const conflict = prevConflictLevel(ctx);
    return {
      tag: 'withdrawal_possible',
      confidence: Math.min(1, 0.55 + (conflict > 0 ? 0.2 : 0)),
      evidence: [evd(wdHits.join(', '), 'withdrawal kalıbı', 'learned_pattern')],
      counterEvidence: [],
    };
  }

  const sdHits = includesAny(text, learnedConflictShutdownCues);
  if (sdHits.length) {
    return {
      tag: 'conflict_shutdown',
      confidence: 0.7,
      evidence: [evd(sdHits.join(', '), 'iletişimi kapatma ifadesi', 'learned_pattern')],
      counterEvidence: [],
    };
  }

  const paHits = includesAny(text, learnedPassiveAggressiveCues);
  if (paHits.length) {
    const conflict = prevConflictLevel(ctx);
    return {
      tag: 'passive_aggressive_possible',
      confidence: Math.min(1, 0.5 + (conflict > 0 ? 0.2 : 0)),
      evidence: [evd(paHits.join(', '), 'pasif-agresif kalıp', 'learned_pattern')],
      counterEvidence: conflict === 0 ? [evd(text, 'prev conflict düşük; samimi de olabilir', 'context')] : [],
    };
  }

  const tsHits = includesAny(text, learnedTopicShiftCues);
  if (tsHits.length && !isBareAck(text)) {
    return {
      tag: 'topic_shift',
      confidence: 0.6,
      evidence: [evd(tsHits.join(', '), 'konu değiştirme', 'learned_pattern')],
      counterEvidence: [],
    };
  }

  // Geriye "bare ack" değerlendirmesi kaldı.
  if (!isBareAck(text)) {
    // Mesaj kısa-ack değil → bu classifier sorumlu değil.
    return { tag: 'none', confidence: 0, evidence: [], counterEvidence: [] };
  }

  // Bare ack: warm vs neutral vs cold kararı.
  const tlc = lc(text);
  const warmHit = [...learnedWarmTerms].find(w => tlc.includes(w));
  const affEmoji = affectionEmojiRegex.test(text);

  if (warmHit || affEmoji) {
    return {
      tag: 'warm_ack',
      confidence: 0.75,
      evidence: [evd(warmHit ?? 'affection emoji', 'kısa ack + warm/affection sinyali', 'learned_pattern')],
      counterEvidence: [],
    };
  }

  const conflict = prevConflictLevel(ctx);
  const longEmotional = prevLastEmotionalLong(ctx);
  const lastPrev = ctx.prev[ctx.prev.length - 1];
  const prevLong = !!(lastPrev && ((lastPrev.content?.length ?? 0) >= learnedPhraseWeights.coldAckPrevLongChars));
  const endsDot = /\.\s*$/.test(text);
  const repair = nextRepairOrWarmth(ctx);

  // Cold ack: prev'de gerilim/uzun-duygu VEYA cold marker
  if (conflict >= 1 || longEmotional || (endsDot && prevLong) || /\.$/.test(text)) {
    const conf = Math.min(1, 0.55 + conflict * 0.1 + (longEmotional ? 0.1 : 0) + (endsDot ? 0.05 : 0));
    const counter = repair
      ? [evd('next: warmth/repair', 'sonraki mesajda yumuşama var; cold ack zayıf', 'context')]
      : [];
    return {
      tag: 'cold_ack',
      confidence: conf,
      evidence: [
        evd(text, 'kısa nötr ack + prev conflict/long emotional', 'context'),
      ],
      counterEvidence: counter,
    };
  }

  // Default neutral ack
  return {
    tag: 'neutral_ack',
    confidence: 0.7,
    evidence: [evd(text, 'kısa nötr ack, ısıtıcı/soğutucu sinyal yok', 'rule')],
    counterEvidence: [],
  };
};
