import { DialogueAct, MessageInsight } from '../types';

const hasScore = (m: MessageInsight, key: keyof MessageInsight['signals'], min = 0.5): boolean =>
  m.signals[key].score >= min || m.signals[key].count > 0;

export const classifyDialogueActs = (
  message: MessageInsight,
  previousMessage?: MessageInsight
): DialogueAct[] => {
  const acts = new Set<DialogueAct>();
  const text = message.textMasked.toLocaleLowerCase('tr-TR');

  if (/^(selam|merhaba|günaydın|iyi geceler|iyi akşamlar)\b/iu.test(text)) acts.add('greeting');
  if (message.hasQuestion) acts.add('question');
  if (hasScore(message, 'affection') || hasScore(message, 'longing')) acts.add('affection');
  if (hasScore(message, 'reassurance')) acts.add('reassurance');
  if (hasScore(message, 'insecurity')) acts.add('reassurance_request');
  if (hasScore(message, 'apology')) acts.add('apology');
  if (hasScore(message, 'repairAttempt') || hasScore(message, 'accountability')) acts.add('repair_attempt');
  if (hasScore(message, 'criticism')) acts.add('complaint');
  if (hasScore(message, 'criticism', 1) || hasScore(message, 'blameShifting')) acts.add('accusation');
  if (hasScore(message, 'defensiveness')) acts.add('defense');
  if (hasScore(message, 'avoidance') || hasScore(message, 'stonewalling')) acts.add('shutdown');
  if (message.isShortReply) acts.add('short_ack');
  if (hasScore(message, 'planning')) acts.add(message.hasQuestion ? 'plan_invitation' : 'plan_confirmation');
  if (hasScore(message, 'cancellation')) acts.add('plan_cancellation');
  if (hasScore(message, 'jealousy') || hasScore(message, 'control')) acts.add('jealousy_check');
  if (hasScore(message, 'boundarySetting')) acts.add('boundary_setting');
  if (hasScore(message, 'boundaryViolation')) acts.add('boundary_violation');
  if (hasScore(message, 'humor') || hasScore(message, 'sarcasm')) acts.add('joke');
  if (hasScore(message, 'sexualOrRomanticIntimacy')) acts.add('flirt');
  if (/görüşürüz|hoşça kal|kendine iyi bak|veda|bitti|ayrılalım|bitirelim/iu.test(text)) acts.add('goodbye');
  if (/çünkü|sebebi|o yüzden|şundan|anlatayım|açıklayayım/iu.test(text)) acts.add('explanation');
  if (/tamam haklısın|sorun değil|affettim|önemli değil/iu.test(text)) acts.add('apology_acceptance');
  if (/neyse|konuyu kapatalım|başka şey|boş ver/iu.test(text)) acts.add('topic_shift');

  if (
    previousMessage &&
    previousMessage.speaker !== message.speaker &&
    previousMessage.conflictScore > 1 &&
    message.isShortReply &&
    message.avoidanceScore > 0.5
  ) {
    acts.add('shutdown');
  }

  if (!acts.size) acts.add('unknown');
  return Array.from(acts);
};
