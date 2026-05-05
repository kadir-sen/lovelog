import {
  CoachInsightContext,
  CoachQueryPlan,
  ConversationProfile,
  EvidenceItem,
  MessageInsight,
  RelationshipPattern,
} from '../types';

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
  manipulation_or_control: ['gaslighting_like', 'control_or_surveillance', 'guilt_tripping_like', 'jealousy_spiral', 'repair_imbalance'],
  one_sidedness: ['emotional_labor_imbalance', 'repair_imbalance', 'slow_fade'],
  conflict_fault: ['repair_imbalance', 'gaslighting_like', 'control_or_surveillance'],
};

const scoreMessage = (m: MessageInsight, plan: CoachQueryPlan): number => {
  let score = 0;
  const needed = new Set(plan.neededSignals);
  Object.entries(m.signals).forEach(([key, detail]) => {
    if (needed.has(key)) score += detail.score * 2;
  });
  if (/ghost|ilgi|soğu|slow/i.test(plan.intent)) score += m.avoidanceScore + m.warmthScore * 0.5 + (m.replyDelayMinutes && m.replyDelayMinutes > 360 ? 1 : 0);
  if (/manip|control|abuse/i.test(plan.intent)) score += m.controlScore * 2 + m.conflictScore + m.signals.manipulationLike.score * 2;
  if (/love|sev|interest/i.test(plan.intent)) score += m.warmthScore * 2 + m.repairScore + m.signals.planning.score;
  if (/conflict|fault|abart/i.test(plan.intent)) score += m.conflictScore * 2 + m.repairScore + m.controlScore;
  return score;
};

export const buildCoachInsightContext = (
  question: string,
  plan: CoachQueryPlan,
  profile: ConversationProfile,
  participants: string[]
): CoachInsightContext => {
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

  const scoredMessages = profile.messageInsights
    .map(m => ({ m, score: scoreMessage(m, plan) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const recentCount = Math.max(12, Math.floor(profile.messageInsights.length * 0.25));
  const recent = profile.messageInsights.slice(-recentCount);
  const old = profile.messageInsights.slice(0, Math.max(1, Math.floor(profile.messageInsights.length * 0.25)));
  const limit = Math.max(8, Math.min(40, plan.retrievalStrategy.messageLimit || 20));

  const retrievedMessages = uniqEvidence([
    ...detectedPatterns.flatMap(p => p.evidence),
    ...relevantEpisodes.flatMap(ep => ep.evidence),
    ...scoredMessages.slice(0, limit).map(({ m }) => toEvidence(m, 'soruya/sinyale göre seçilen mesaj')),
    ...(plan.retrievalStrategy.includeRecentExamples ? recent.filter(m => scoreMessage(m, plan) > 0.4).slice(-8).map(m => toEvidence(m, 'son dönem örneği')) : []),
    ...(plan.retrievalStrategy.includeOldBaseline ? old.filter(m => m.warmthScore > 0.4 || m.signals.planning.score > 0).slice(0, 6).map(m => toEvidence(m, 'eski baseline örneği')) : []),
  ], limit);

  const counterEvidence = uniqEvidence([
    ...detectedPatterns.flatMap(p => p.counterEvidence),
    ...relevantEpisodes.flatMap(ep => ep.counterEvidence),
    ...profile.messageInsights
      .filter(m => m.warmthScore > 1 || m.repairScore > 1 || m.signals.accountability.score > 0.5)
      .slice(-8)
      .map(m => toEvidence(m, 'karşı kanıt: sıcaklık/onarma/sorumluluk')),
  ], 8);

  const trendWindow = /ghost|ilgi|soğu|love|sev|interest/i.test(plan.intent)
    ? profile.weeklyTrends.slice(-8)
    : profile.weeklyTrends.slice(-4);

  return {
    userQuestion: question,
    plan,
    conversationOverview: {
      totalMessages: profile.totalMessages,
      dateRange: `${profile.dateRange.start} / ${profile.dateRange.end}`,
      participants,
    },
    relevantMetrics: profile.globalMetrics,
    relevantTrends: trendWindow,
    detectedPatterns,
    relevantEpisodes,
    retrievedMessages,
    counterEvidence,
    safetyNotes: plan.safetyMode === 'normal'
      ? []
      : ['Kullanıcı sorusu güvenlik hassasiyeti taşıyor; kanıt yetersizse bile gerçek dünyada destek ve güvenlik önceliklendirilmeli.'],
    answerRules: [
      'Kesin hüküm verme.',
      'Kanıt ve karşı kanıtı birlikte sun.',
      'Psikolojik/klinik teşhis koyma.',
      'Mesajlarda olmayan alıntı veya olay uydurma.',
      'Türkçe, sıcak ve kanıta dayalı yanıt ver.',
    ],
  };
};
