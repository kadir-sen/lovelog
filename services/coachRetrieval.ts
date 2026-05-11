import {
  CoachInsightContext,
  CoachChatTurn,
  CoachQueryPlan,
  ConversationProfile,
  EvidenceItem,
  MessageInsight,
  RelationshipPattern,
} from '../types';
import { RelationshipMode } from './relationshipReport';

const uniqEvidence = (items: EvidenceItem[], limit: number): EvidenceItem[] => {
  const seen = new Set<string>();
  const out: EvidenceItem[] = [];
  items.forEach(item => {
    if (seen.has(item.messageId)) return;
    seen.add(item.messageId);
    out.push(item);
  });
  return out.slice(0, limit);
};

const toEvidence = (m: MessageInsight, reason: string): EvidenceItem => ({
  messageId: m.messageId,
  timestamp: m.timestamp,
  speaker: m.speaker,
  quoteMasked: m.textMasked,
  reason,
});

const PATTERN_MAP: Record<string, RelationshipPattern['type'][]> = {
  ghosting_or_interest_drop: ['slow_fade', 'hot_cold_cycle', 'breadcrumbing', 'reciprocity_drop'],
  love_or_interest: ['slow_fade', 'hot_cold_cycle', 'repair_imbalance'],
  positive_gesture_check: ['love_bombing_like', 'hot_cold_cycle', 'slow_fade', 'repair_imbalance', 'future_faking_like', 'gaslighting_like', 'control_or_surveillance'],
  manipulation_or_control: ['gaslighting_like', 'control_or_surveillance', 'guilt_tripping_like', 'jealousy_spiral', 'repair_imbalance'],
  one_sidedness: ['emotional_labor_imbalance', 'repair_imbalance', 'slow_fade'],
  conflict_fault: ['repair_imbalance', 'gaslighting_like', 'control_or_surveillance'],
  friendship_dynamic: ['emotional_labor_imbalance', 'repair_imbalance', 'reciprocity_drop', 'plan_cancel_pattern'],
};

const scoreMessage = (m: MessageInsight, plan: CoachQueryPlan, relationMode: RelationshipMode): number => {
  let score = 0;
  const needed = new Set(plan.neededSignals);
  Object.entries(m.signals).forEach(([key, detail]) => {
    if (needed.has(key)) score += detail.score * 2;
  });
  if (/ghost|ilgi|soğu|slow/i.test(plan.intent)) score += m.avoidanceScore + m.warmthScore * 0.5 + (m.replyDelayMinutes && m.replyDelayMinutes > 360 ? 1 : 0);
  if (/manip|control|abuse/i.test(plan.intent)) score += m.controlScore * 2 + m.conflictScore + m.signals.manipulationLike.score * 2;
  if (/love|sev|interest/i.test(plan.intent)) score += m.warmthScore * 2 + m.repairScore + m.signals.planning.score;
  if (/positive_gesture|gift|gesture/i.test(plan.intent)) {
    score += m.warmthScore
      + m.repairScore * 1.4
      + m.signals.apology.score
      + m.signals.planning.score
      + m.signals.cancellation.score
      + m.conflictScore * 1.2
      + m.controlScore
      + m.avoidanceScore;
  }
  if (/conflict|fault|abart/i.test(plan.intent)) score += m.conflictScore * 2 + m.repairScore + m.controlScore;
  if (relationMode === 'friend') {
    if (/friend|arkadaş|kanka|support|vibe|drama|one_sidedness/i.test(plan.intent)) {
      score += m.signals.friendSupport.score * 2
        + m.signals.insideJoke.score
        + m.signals.friendCheckIn.score * 1.4
        + m.signals.friendReciprocity.score * 1.5
        + m.signals.friendDrama.score * 2
        + m.signals.friendExclusion.score * 2
        + m.signals.planning.score * 0.8
        + m.signals.cancellation.score;
    }
  }
  return score;
};

const isWithinPlanTime = (m: MessageInsight, plan: CoachQueryPlan, referenceEnd?: string): boolean => {
  const { mode, startDate, endDate, days } = plan.timeRange;
  if (mode === 'specific_date' && startDate) return m.dateKey === startDate;
  if ((mode === 'specific_range' || mode === 'before_after') && startDate && endDate) {
    return m.dateKey >= startDate && m.dateKey <= endDate;
  }
  if (mode === 'recent' && days) {
    const timestamp = new Date(m.timestamp).getTime();
    const end = referenceEnd ? new Date(referenceEnd).getTime() : Date.now();
    return Number.isFinite(timestamp) && Number.isFinite(end) && timestamp >= end - days * 86400000;
  }
  return true;
};

const sanitizeCoachTurns = (turns: CoachChatTurn[] = []): CoachChatTurn[] =>
  turns
    .filter(turn => turn.content.trim())
    .slice(-8)
    .map(turn => ({
      role: turn.role,
      content: turn.content.replace(/\s+/g, ' ').trim().slice(0, 700),
    }));

const usesExplicitTimeScope = (plan: CoachQueryPlan): boolean =>
  plan.timeRange.mode !== 'all';

const queryFrame = (question: string, plan: CoachQueryPlan): CoachInsightContext['queryFrame'] => {
  const q = question.toLocaleLowerCase('tr-TR');
  const positive = /hediye|s[üu]rpriz|çiçek|cicek|g[üu]zel|tatl[ıi]|iyi|ald[ıi]|yapt[ıi]|jest|bar[ıi][şs]t[ıi]k|özür diledi|telafi/i.test(q);
  const safety = plan.safetyMode !== 'normal';
  const advice = /ne yaz|nas[ıi]l|sence|ne yap|cevap|mesaj/i.test(q);
  const negative = /kork|tehdit|manip|gaslight|abart|suç|kavga|trip|ghost|so[ğg]u|aldat|kontrol|konum|k[ıi]skan/i.test(q);
  return {
    topic: plan.intent,
    userFraming: safety ? 'safety' : positive ? 'positive' : negative ? 'negative' : advice ? 'request_advice' : 'ambiguous',
    needsProactiveRiskCheck: !safety,
    reason: positive
      ? 'Kullanıcı olumlu/jest gibi görünen bir olayı soruyor; geçmişteki zarar-özür-jest-soğuma çelişkileri kontrol edilmeli.'
      : safety
      ? 'Güvenlik hassasiyeti var; örüntü çıkarımı değil koruma önceliklendirilecek.'
      : negative
      ? 'Kullanıcı riskli bir ilişki davranışını soruyor.'
      : 'Genel soru; risk taraması yine açık tutulacak çünkü kullanıcı içeriden tüm örüntüleri görmeyebilir.',
  };
};

const ALWAYS_ON_RISK_METRICS = ['controlJealousyRisk', 'avoidanceScore', 'repairBalance'] as const;

const metricKeysByIntent: Record<string, string[]> = {
  positive_gesture_check: ['affectionConsistency', 'conflictIntensity', 'conflictRecoverySpeed', 'repairBalance', 'avoidanceScore', 'controlJealousyRisk', 'hotColdScore', 'ghostingRisk'],
  ghosting_or_interest_drop: ['affectionConsistency', 'responseLatencyAsymmetry', 'avoidanceScore', 'ghostingRisk', 'hotColdScore', 'reciprocityScore'],
  love_or_interest: ['affectionConsistency', 'reciprocityScore', 'initiativeBalance', 'repairBalance', 'avoidanceScore', 'hotColdScore'],
  manipulation_or_control: ['controlJealousyRisk', 'conflictIntensity', 'emotionalLaborImbalance', 'repairBalance', 'avoidanceScore'],
  one_sidedness: ['reciprocityScore', 'initiativeBalance', 'emotionalLaborImbalance', 'repairBalance', 'oneSidednessScore'],
  conflict_fault: ['conflictIntensity', 'conflictRecoverySpeed', 'repairBalance', 'controlJealousyRisk'],
  friendship_dynamic: ['reciprocityScore', 'initiativeBalance', 'emotionalLaborImbalance', 'repairBalance', 'avoidanceScore'],
};

const selectMetrics = (metrics: ConversationProfile['globalMetrics'], plan: CoachQueryPlan): Record<string, number | string> => {
  const intentKeys = metricKeysByIntent[plan.intent] || ['reciprocityScore', 'conflictIntensity', 'avoidanceScore', 'controlJealousyRisk'];
  const keys = Array.from(new Set([...intentKeys, ...ALWAYS_ON_RISK_METRICS]));
  return Object.fromEntries(keys.map(key => [key, metrics[key as keyof typeof metrics]]).filter(([, value]) => value !== undefined));
};

const riskWeight = (type: RelationshipPattern['type']): number => {
  const weights: Partial<Record<RelationshipPattern['type'], number>> = {
    gaslighting_like: 1,
    control_or_surveillance: 0.98,
    guilt_tripping_like: 0.94,
    hot_cold_cycle: 0.9,
    love_bombing_like: 0.88,
    slow_fade: 0.82,
    repair_imbalance: 0.8,
    future_faking_like: 0.78,
    emotional_labor_imbalance: 0.72,
    reciprocity_drop: 0.7,
  };
  return weights[type] || 0.5;
};

const whyRiskMatters = (type: RelationshipPattern['type']): string => {
  const text: Partial<Record<RelationshipPattern['type'], string>> = {
    gaslighting_like: 'Duygunun küçümsenmesi veya gerçekliğin bulanıklaştırılması kadının kendi sezgisinden şüphe etmesine yol açabilir.',
    control_or_surveillance: 'Kontrol/kıskançlık romantik ilgi gibi paketlenebilir ama sınır ve güvenlik açısından ciddi bir sinyaldir.',
    love_bombing_like: 'Büyük jestler geçmişteki ihmal veya kırıcı davranışları görünmez kılıyorsa bu telafi/jest döngüsü olabilir.',
    hot_cold_cycle: 'Sıcak-soğuk döngüsü bağımlılık hissi yaratabilir; tek bir güzel an bütün ritmi temsil etmeyebilir.',
    slow_fade: 'Geri çekilme örüntüsü varsa son jesti tutarlılık üzerinden okumak gerekir.',
    repair_imbalance: 'Özür veya telafi var ama davranış değişmiyorsa ilişkiyi taşıma yükü tek tarafa binebilir.',
    future_faking_like: 'Gelecek vaadi ve plan iptali birlikteyse söz-davranış farkına bakmak gerekir.',
  };
  return text[type] || 'Bu örüntü son olayı tek başına değil, tekrar eden davranışlarla birlikte okumayı gerektirir.';
};

const surfaceRisks = (
  profile: ConversationProfile,
  plan: CoachQueryPlan,
  frame: CoachInsightContext['queryFrame']
): CoachInsightContext['surfacedRisks'] => {
  if (!frame.needsProactiveRiskCheck) return [];
  const riskTypes = new Set<RelationshipPattern['type']>([
    'gaslighting_like',
    'control_or_surveillance',
    'guilt_tripping_like',
    'hot_cold_cycle',
    'love_bombing_like',
    'slow_fade',
    'repair_imbalance',
    'future_faking_like',
    'emotional_labor_imbalance',
    'jealousy_spiral',
    'attack_apology_cycle',
  ]);
  // When user frames positively, scan harder: lower the cutoff and pull more risks.
  const isPositive = frame.userFraming === 'positive';
  const minScore = isPositive ? 0.25 : 0.4;
  const limit = isPositive ? 6 : 4;
  return profile.topPatterns
    .filter(pattern => riskTypes.has(pattern.type) || (plan.neededPatterns as RelationshipPattern['type'][]).includes(pattern.type))
    .filter(pattern => (pattern.severity + pattern.confidence) * riskWeight(pattern.type) >= minScore)
    .sort((a, b) => ((b.severity + b.confidence) * riskWeight(b.type)) - ((a.severity + a.confidence) * riskWeight(a.type)))
    .slice(0, limit)
    .map(pattern => ({
      type: pattern.type,
      severity: pattern.severity,
      confidence: pattern.confidence,
      whyItMatters: whyRiskMatters(pattern.type),
      evidence: pattern.evidence.slice(0, 3),
    }));
};

export const buildCoachInsightContext = (
  question: string,
  plan: CoachQueryPlan,
  profile: ConversationProfile,
  participants: string[],
  relationMode: RelationshipMode,
  viewerName?: string | null,
  chatHistory: CoachChatTurn[] = []
): CoachInsightContext => {
  const referenceEnd = profile.messageInsights[profile.messageInsights.length - 1]?.timestamp;
  const frame = queryFrame(question, plan);
  const patternTypes = new Set<RelationshipPattern['type']>([
    ...(PATTERN_MAP[plan.intent] || []),
    ...(plan.neededPatterns as RelationshipPattern['type'][]),
  ]);
  const detectedPatterns = profile.topPatterns
    .filter(p => patternTypes.size === 0 || patternTypes.has(p.type))
    .slice(0, 6);

  const relevantEpisodes = profile.keyEpisodes
    .filter(ep => plan.neededEpisodes.length === 0 || plan.neededEpisodes.includes(ep.type))
    .slice(0, 6);

  const hasTimeScope = usesExplicitTimeScope(plan);
  const scoredMessages = profile.messageInsights
    .map(m => ({
      m,
      score: scoreMessage(m, plan, relationMode) + (hasTimeScope && isWithinPlanTime(m, plan, referenceEnd) ? 3 : 0),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const timeScopedMessages = hasTimeScope
    ? profile.messageInsights
        .filter(m => isWithinPlanTime(m, plan, referenceEnd))
        .slice(0, Math.max(8, Math.min(20, plan.retrievalStrategy.messageLimit || 16)))
        .map(m => toEvidence(m, 'sorudaki zaman aralığı'))
    : [];

  const recentCount = Math.max(12, Math.floor(profile.messageInsights.length * 0.25));
  const recent = profile.messageInsights.slice(-recentCount);
  const old = profile.messageInsights.slice(0, Math.max(1, Math.floor(profile.messageInsights.length * 0.25)));
  const limit = Math.max(8, Math.min(40, plan.retrievalStrategy.messageLimit || 20));
  const surfacedRisks = surfaceRisks(profile, plan, frame);

  const retrievedMessages = uniqEvidence([
    ...timeScopedMessages,
    ...surfacedRisks.flatMap(risk => risk.evidence),
    ...detectedPatterns.flatMap(p => p.evidence),
    ...relevantEpisodes.flatMap(ep => ep.evidence),
    ...scoredMessages.slice(0, limit).map(({ m }) => toEvidence(m, 'soruya/sinyale göre seçilen mesaj')),
    ...(plan.retrievalStrategy.includeRecentExamples ? recent.filter(m => scoreMessage(m, plan, relationMode) > 0.4).slice(-8).map(m => toEvidence(m, 'son dönem örneği')) : []),
    ...(plan.retrievalStrategy.includeOldBaseline ? old.filter(m => m.warmthScore > 0.4 || m.signals.planning.score > 0).slice(0, 6).map(m => toEvidence(m, 'eski baseline örneği')) : []),
  ], limit);

  // Counter-evidence intentionally capped low: persona surfaces risks; warm signals
  // are included for honesty, not to outweigh repeated harm.
  const counterEvidence = uniqEvidence([
    ...detectedPatterns.flatMap(p => p.counterEvidence),
    ...relevantEpisodes.flatMap(ep => ep.counterEvidence),
    ...profile.messageInsights
      .filter(m => m.warmthScore > 1 || m.repairScore > 1 || m.signals.accountability.score > 0.5)
      .slice(-3)
      .map(m => toEvidence(m, 'karşı kanıt: sıcaklık/onarma/sorumluluk')),
  ], 3);

  const trendWindow = /ghost|ilgi|soğu|love|sev|interest/i.test(plan.intent)
    ? profile.weeklyTrends.slice(-8)
    : profile.weeklyTrends.slice(-4);

  return {
    userQuestion: question,
    recentCoachTurns: sanitizeCoachTurns(chatHistory),
    viewerPerspective: {
      selectedName: viewerName || null,
      selectedRole: viewerName
        ? profile.messageInsights.find(m => m.speaker === viewerName)?.normalizedSpeaker || 'unknown'
        : 'unknown',
    },
    queryFrame: frame,
    plan,
    conversationOverview: {
      totalMessages: profile.totalMessages,
      dateRange: `${profile.dateRange.start} / ${profile.dateRange.end}`,
      participants,
    },
    relevantMetrics: selectMetrics(profile.globalMetrics, plan),
    relevantTrends: trendWindow,
    detectedPatterns,
    surfacedRisks,
    relevantEpisodes,
    retrievedMessages,
    counterEvidence,
    safetyNotes: (() => {
      const notes: string[] = [];
      if (plan.safetyMode !== 'normal') {
        notes.push('Kullanıcı sorusu güvenlik hassasiyeti taşıyor; kanıt yetersizse bile gerçek dünyada destek ve güvenlik önceliklendirilmeli.');
      }
      if ((plan as CoachQueryPlan & { userClaimedNewEvidence?: boolean }).userClaimedNewEvidence) {
        notes.push(
          'Kullanıcı sohbet dışında yeni bir iddia ekledi (ör. "bana vurdu", "tehdit etti"). Bu iddiayı yorumla, ama dosyada doğrulanmamışsa "kanıt" olarak sunma; "şu an sen söylüyorsun, bu ciddi — eğer gerçekten oldu ise..." diye yansıt ve gerçek dünya adımları öner.'
        );
      }
      return notes;
    })(),
    answerRules: [
      'Kesin hüküm verme.',
      'Kanıt ve karşı kanıtı birlikte sun.',
      'Psikolojik/klinik teşhis koyma.',
      'Mesajlarda olmayan alıntı veya olay uydurma.',
      'Türkçe, sıcak ve kanıta dayalı yanıt ver.',
    ],
  };
};
