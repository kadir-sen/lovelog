// services/nlp/index.ts — pure orchestrator.
// analyzeChat sonunda opsiyonel olarak buildMessageInsights çağırır;
// orphan modülleri (relationshipSignals, dialogueActs, episodeExtractor) bağlar.

import type {
  ConversationStyleProfile,
  MessageInsight,
  NormalizedMessage,
  RelationshipEpisode,
  EvidenceItem,
  DialogueAct,
} from '../../types';
import { extractRelationshipSignals } from '../relationshipSignals';
import { classifyDialogueActs } from '../dialogueActs';
import { extractRelationshipEpisodes } from '../episodeExtractor';

import { buildContextWindowFor, prevConflictLevel } from './contextWindow';
import { classifyShortReply } from './shortReplyClassifier';
import { detectSarcasm } from './sarcasmModifier';
import { classifyLaugh } from './laughClassifier';
import { classifyControlPressure } from './controlPressureClassifier';
import { computeNegationScope } from './negationScope';
// PR-4..8 couple-dialect classifier'ları
import {
  classifyEmojiCluster,
  applyEmojiClusterBoost,
  enforceAffectionFloor,
} from './emojiClusterClassifier';
import { classifyRitual, applyRitualBoost } from './ritualMessageClassifier';
import {
  classifyIntensifierDrag,
  injectSarcasmCounter,
} from './intensifierDragClassifier';
import {
  classifyEchoResponse,
  applyEchoBoost,
} from './echoResponseClassifier';
import {
  aggregateConfidence,
  isVisible,
  needsReview,
} from './confidence';
import { collectEvidence, toEvidenceItem } from './evidence';
import { classifierTagToDialogueAct } from './labelMapping';
import type { ClassifierResult, EnrichedInsight, BuildInsightsOptions, ClassifierTag } from './types';
import { buildStyleProfile, DEFAULT_STYLE_PROFILE } from './styleProfile';

const uniq = <T>(arr: T[]): T[] => [...new Set(arr)];

const decideAuthorKey = (msg: NormalizedMessage, authorRank: Map<string, number>): 'A' | 'B' | undefined => {
  const r = authorRank.get(msg.author);
  if (r === 0) return 'A';
  if (r === 1) return 'B';
  return undefined;
};

/**
 * Tüm normalize edilmiş mesajlar için zenginleştirilmiş MessageInsight üretir.
 * Hiçbir IO yapmaz; "pure" çağrı zinciri.
 *
 * Orkestrasyon sırası (plan §8):
 *   1. extractRelationshipSignals (orphan modül)
 *   2. shortReply / sarcasm / laugh / control
 *   3. negation scope (affection/harsh damper)
 *   4. sarcasm warmth dampener
 *   5. ritualMessageClassifier
 *   6. emojiClusterClassifier (sarcasm dampener'ı aşarak min floor)
 *   7. intensifierDragClassifier (sarcasm.counterEvidence enjeksiyonu)
 *   8. echoResponseClassifier (out[] üzerinden son N enriched insight okur)
 *   9. confidence + evidence aggregate
 *  10. dialogueActs uniq
 */
export const buildMessageInsights = (
  messages: NormalizedMessage[],
  options: BuildInsightsOptions = {}
): EnrichedInsight[] => {
  if (!messages.length) return [];

  const authorCounts = new Map<string, number>();
  for (const m of messages) authorCounts.set(m.author, (authorCounts.get(m.author) ?? 0) + 1);
  const authorRank = new Map<string, number>();
  [...authorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k], i) => authorRank.set(k, i));

  const out: EnrichedInsight[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.isMedia) continue;

    const ctx = buildContextWindowFor(messages, i, { prev: 3, next: 2 });

    // 1) Orphan modül: relationshipSignals.extractRelationshipSignals
    const baseInsight = extractRelationshipSignals(m, ctx.prev[ctx.prev.length - 1]);

    // 2) Mevcut classifier'lar
    const shortReply = classifyShortReply(ctx);
    const sarcasm = detectSarcasm(ctx);
    const laugh = classifyLaugh(ctx);
    const control = classifyControlPressure(ctx);
    const negation = computeNegationScope(m.content || '');

    // 3) Negation effect
    if (negation.affectionNegated) {
      baseInsight.signals.affection.score = 0;
      baseInsight.signals.affection.negated = true;
      baseInsight.signals.longing.score = 0;
    }
    if (negation.harshNegated) {
      baseInsight.signals.harshLanguage.score = 0;
      baseInsight.signals.harshLanguage.negated = true;
    }
    if (negation.planUnavailable) {
      baseInsight.signals.cancellation.score = Math.max(baseInsight.signals.cancellation.score, 0.7);
    }
    if (negation.refusalPresent) {
      baseInsight.signals.boundarySetting.score = Math.max(baseInsight.signals.boundarySetting.score, 0.5);
    }

    // 4) Sarcasm warmth dampener
    if (sarcasm.tag === 'sarcasm_possible' && sarcasm.modifiers?.dampensWarmth) {
      baseInsight.signals.affection.score *= 0.4;
      baseInsight.signals.affection.playfulDampened = true;
    }

    // 5) Ritual classifier — saat-aware, affection.score'a katkı
    const ritual = classifyRitual(ctx);
    if (ritual.tag === 'ritual_message') applyRitualBoost(baseInsight.signals, ritual);

    // 6) Emoji cluster classifier — sarcasm dampener'ı aşarak min floor
    const emojiCluster = classifyEmojiCluster(ctx);
    if (emojiCluster.tag !== 'none') {
      applyEmojiClusterBoost(baseInsight.signals, emojiCluster);
      enforceAffectionFloor(baseInsight.signals, emojiCluster);
    }

    // 7) Intensifier-drag classifier — sarcasm counterEvidence enjeksiyonu
    const drag = classifyIntensifierDrag(ctx);
    if (drag.modifiers.onWarmTerm) {
      injectSarcasmCounter(sarcasm, drag);
    }

    // 8) Echo response — geriye N=3 enriched insight üzerinden okur
    const echo = classifyEchoResponse({
      target: m,
      targetTagsHint: [
        emojiCluster.tag,
        ritual.tag,
        ...(baseInsight.signals.affection.score > 0 ? ['warm_ack' as const] : []),
      ],
      priorInsights: out,
    });
    if (echo.tag === 'echo_warmth') applyEchoBoost(baseInsight.signals, echo);

    const classifierResults: ClassifierResult[] = [
      shortReply, sarcasm, laugh, control,
      ritual, emojiCluster, drag, echo,
    ].filter(r => r.tag !== 'none' && r.confidence > 0);

    // 9) Confidence + evidence aggregate
    const confidence = aggregateConfidence(classifierResults);
    const { evidence, counterEvidence } = collectEvidence(m, classifierResults);

    // 10) DialogueAct birleştir
    const fromMapping: DialogueAct[] = classifierResults
      .map(r => classifierTagToDialogueAct[r.tag as ClassifierTag])
      .filter((d): d is DialogueAct => !!d);

    let dialogueActs: DialogueAct[];
    try {
      const prevInsight = out[out.length - 1];
      dialogueActs = uniq([
        ...fromMapping,
        ...classifyDialogueActs(baseInsight, prevInsight),
      ]);
    } catch {
      dialogueActs = uniq(fromMapping);
    }
    if (!dialogueActs.length) dialogueActs = ['unknown'];
    baseInsight.dialogueActs = dialogueActs;

    // 11) EnrichedInsight oluştur
    const enriched: EnrichedInsight = {
      ...baseInsight,
      classifierTags: classifierResults,
      confidenceOverall: confidence,
      evidence,
      counterEvidence,
      modifiers: {
        negated: negation.negatedClauses > 0,
        negationClauseScoped: negation.negatedClauses > 0,
        playful: laugh.tag === 'real_laugh' || laugh.tag === 'flirty_laugh',
        sarcasm: sarcasm.tag === 'sarcasm_possible',
        laughKind: laugh.tag !== 'none' ? (laugh.tag.replace('_laugh', '') as any) : undefined,
        emojiCluster: emojiCluster.tag !== 'none'
          ? {
              // Cluster kind yoksa (sadece custom binding ile inside_joke_pattern)
              // 'same_repeat_2'yi default-marker olarak kullan.
              kind: emojiCluster.modifiers.clusterKind ?? 'same_repeat_2',
              size: emojiCluster.modifiers.clusterSize,
              bursting: emojiCluster.modifiers.bursting,
              customAffection: emojiCluster.modifiers.customAffection,
              boundWarmTerm: emojiCluster.modifiers.boundWarmTerm,
            }
          : undefined,
        ritualKind: ritual.modifiers.ritualKind,
        timeOfDay: ritual.modifiers.timeOfDay,
        ritualInExpectedWindow: ritual.modifiers.inExpectedWindow,
        intensifierDrag: drag.tag !== 'none'
          ? {
              onWarmTerm: drag.modifiers.onWarmTerm,
              onFiller: drag.modifiers.onFiller,
              maxRepeatLen: drag.modifiers.maxRepeatLen,
            }
          : undefined,
        echoLagMessages: echo.tag === 'echo_warmth' ? echo.modifiers.echoLagMessages : undefined,
        echoLagMinutes: echo.tag === 'echo_warmth' ? (echo.modifiers.echoLagMinutes ?? undefined) : undefined,
      },
      styleAuthorKey: decideAuthorKey(m, authorRank),
      source: uniq(classifierResults.flatMap(r => r.evidence.map(e => e.source))),
    };

    out.push(enriched);
  }

  for (const ins of out) {
    const hasCounter = (ins.counterEvidence?.length ?? 0) > 0;
    if (!isVisible(ins.confidenceOverall, hasCounter)) {
      // visibility flag'i ileri PR'larda raporlama için kullanılacak
    }
    void needsReview;
  }

  return out;
};

/** Episode'ları runtime'da çıkar. */
export const extractEpisodes = (insights: EnrichedInsight[]): RelationshipEpisode[] => {
  return extractRelationshipEpisodes(insights);
};

export { buildStyleProfile, DEFAULT_STYLE_PROFILE };
export type { EnrichedInsight, BuildInsightsOptions } from './types';
