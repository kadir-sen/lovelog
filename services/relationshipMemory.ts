import {
  AnalysisResult,
  ConversationProfile,
  EvidenceItem,
  MessageInsight,
  NormalizedMessage,
  RelationshipPattern,
} from '../types';
import { classifyDialogueActs } from './dialogueActs';
import { extractRelationshipEpisodes } from './episodeExtractor';
import { extractRelationshipSignals } from './relationshipSignals';

const cache = new Map<string, ConversationProfile>();

const clamp = (n: number): number => Math.max(0, Math.min(1, Number(n.toFixed(3))));
const avg = (items: number[]): number => items.length ? items.reduce((a, b) => a + b, 0) / items.length : 0;

const evidence = (m: MessageInsight, reason: string): EvidenceItem => ({
  messageId: m.messageId,
  timestamp: m.timestamp,
  speaker: m.speaker,
  quoteMasked: m.textMasked,
  reason,
});

const cacheKey = (messages: NormalizedMessage[]): string => {
  const first = messages[0];
  const last = messages[messages.length - 1];
  const checksum = messages
    .filter((_, i) => i % Math.max(1, Math.floor(messages.length / 20)) === 0)
    .map(m => `${m.author}:${m.content.length}:${m.content.slice(0, 8)}`)
    .join('|');
  return `${messages.length}:${first?.date.toISOString()}:${last?.date.toISOString()}:${checksum}`;
};

const buildInsights = (analysis: AnalysisResult): MessageInsight[] => {
  const viewer = analysis.participants[0]?.name;
  const partner = analysis.participants.find(p => p.name !== viewer)?.name;
  const insights = analysis.normalizedMessages.map((msg, index) => {
    const previous = analysis.normalizedMessages[index - 1];
    const insight = extractRelationshipSignals(msg, previous);
    const prevDifferent = previous && previous.author !== msg.author ? previous : undefined;
    insight.replyDelayMinutes = prevDifferent ? (msg.date.getTime() - previous.date.getTime()) / 60000 : undefined;
    insight.normalizedSpeaker = msg.author === viewer ? 'user' : msg.author === partner ? 'partner' : 'other';
    return insight;
  });
  insights.forEach((insight, index) => {
    insight.dialogueActs = classifyDialogueActs(insight, insights[index - 1]);
  });
  return insights;
};

const groupByPeriod = (insights: MessageInsight[], mode: 'week' | 'month'): Array<Record<string, number | string>> => {
  const groups: Record<string, MessageInsight[]> = {};
  insights.forEach(item => {
    const d = new Date(item.timestamp);
    const key = mode === 'month'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}-W${String(Math.ceil((((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7)).padStart(2, '0')}`;
    groups[key] = groups[key] || [];
    groups[key].push(item);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([period, items]) => ({
    period,
    messages: items.length,
    warmth: Number(avg(items.map(i => i.warmthScore)).toFixed(2)),
    conflict: Number(avg(items.map(i => i.conflictScore)).toFixed(2)),
    avoidance: Number(avg(items.map(i => i.avoidanceScore)).toFixed(2)),
    control: Number(avg(items.map(i => i.controlScore)).toFixed(2)),
    repair: Number(avg(items.map(i => i.repairScore)).toFixed(2)),
  }));
};

const participantStats = (analysis: AnalysisResult, insights: MessageInsight[]): ConversationProfile['participantStats'] => {
  const total = Math.max(1, insights.length);
  return Object.fromEntries(analysis.participants.map(p => {
    const mine = insights.filter(i => i.speaker === p.name);
    return [p.name, {
      messageCount: mine.length,
      messageShare: clamp(mine.length / total),
      initiativeCount: p.initiations,
      avgReplyDelayMinutes: Number(avg(mine.map(i => i.replyDelayMinutes || 0).filter(Boolean)).toFixed(1)),
      affectionRate: clamp(mine.filter(i => i.warmthScore > 0.5).length / Math.max(1, mine.length)),
      questionRate: clamp(mine.filter(i => i.hasQuestion).length / Math.max(1, mine.length)),
      repairRate: clamp(mine.filter(i => i.repairScore > 0.5).length / Math.max(1, mine.length)),
      avoidanceRate: clamp(mine.filter(i => i.avoidanceScore > 0.5).length / Math.max(1, mine.length)),
    }];
  }));
};

const pattern = (
  type: RelationshipPattern['type'],
  summary: string,
  confidence: number,
  severity: number,
  ev: EvidenceItem[],
  counter: EvidenceItem[] = [],
  metrics: Record<string, number | string> = {},
  perpetrator?: string,
  affected?: string
): RelationshipPattern => ({
  type,
  summary,
  confidence: clamp(confidence),
  severity: clamp(severity),
  evidence: ev.slice(0, 5),
  counterEvidence: counter.slice(0, 4),
  metrics,
  perpetrator,
  affected,
});

const detectAdvancedPatterns = (analysis: AnalysisResult, insights: MessageInsight[]): RelationshipPattern[] => {
  const patterns: RelationshipPattern[] = [];
  const participants = analysis.participants.map(p => p.name).slice(0, 2);
  const [a, b] = participants;
  const midpoint = Math.floor(insights.length / 2);
  const early = insights.slice(0, midpoint);
  const late = insights.slice(midpoint);

  participants.forEach(person => {
    const earlyMine = early.filter(i => i.speaker === person);
    const lateMine = late.filter(i => i.speaker === person);
    const earlyShare = earlyMine.length / Math.max(1, early.length);
    const lateShare = lateMine.length / Math.max(1, late.length);
    const affectionDrop = avg(earlyMine.map(i => i.warmthScore)) - avg(lateMine.map(i => i.warmthScore));
    const delayRise = avg(lateMine.map(i => i.replyDelayMinutes || 0).filter(Boolean)) - avg(earlyMine.map(i => i.replyDelayMinutes || 0).filter(Boolean));
    if (earlyShare - lateShare > 0.18 && (affectionDrop > 0.25 || delayRise > 60)) {
      patterns.push(pattern(
        'slow_fade',
        `${person} tarafında son dönemde mesaj payı, sıcaklık veya dönüş hızı zayıflamış görünüyor; bu kesin ghosting değil, yavaş geri çekilme sinyali olabilir.`,
        0.55 + Math.min(0.35, earlyShare - lateShare + Math.max(0, affectionDrop) / 4),
        earlyShare - lateShare + Math.min(0.4, Math.max(0, delayRise) / 600),
        [...earlyMine.filter(i => i.warmthScore > 0.5).slice(0, 1), ...lateMine.slice(-3)].map((i, idx) => evidence(i, idx === 0 ? 'eski sıcak/baseline örnek' : 'son dönem örneği')),
        lateMine.filter(i => i.warmthScore > 0.8).slice(-2).map(i => evidence(i, 'son dönemde karşı kanıt: sıcaklık var')),
        { earlyShare: Number(earlyShare.toFixed(2)), lateShare: Number(lateShare.toFixed(2)), affectionDrop: Number(affectionDrop.toFixed(2)), delayRiseMinutes: Number(delayRise.toFixed(1)) },
        person,
        participants.find(p => p !== person)
      ));
    }
  });

  const warmPeaks = insights.filter(i => i.warmthScore >= 2);
  const coldAfter = warmPeaks.filter(peak => insights.some(i => i.speaker === peak.speaker && new Date(i.timestamp) > new Date(peak.timestamp) && i.avoidanceScore > 0.8 && (new Date(i.timestamp).getTime() - new Date(peak.timestamp).getTime()) / 60000 < 3 * 24 * 60));
  if (coldAfter.length >= 2) {
    patterns.push(pattern('hot_cold_cycle', 'Yoğun sıcaklık sonrası kısa cevap/geri çekilme en az iki kez tekrar etmiş; hot-cold döngüsü sinyali var.', 0.68, coldAfter.length / 5, coldAfter.slice(0, 4).map(i => evidence(i, 'sıcak dönem sonrası soğuma'))));
  }

  participants.forEach(person => {
    const mine = insights.filter(i => i.speaker === person);
    const control = mine.filter(i => i.controlScore > 0.8);
    if (control.length >= 3) {
      patterns.push(pattern('control_or_surveillance', `${person} tarafında konum/kimleydin/hesap sorma gibi kontrol-kıskançlık sinyalleri tekrar ediyor.`, 0.72, control.length / 8, control.map(i => evidence(i, 'kontrol/kıskançlık sinyali')), [], { count: control.length }, person, participants.find(p => p !== person)));
    }
    const gas = mine.filter(i => i.signals.manipulationLike.score > 0.5 || i.signals.contempt.evidenceTerms.some(t => /abart|drama|uydur/iu.test(t)));
    if (gas.length >= 2) {
      patterns.push(pattern('gaslighting_like', `${person} tarafında gerçekliği küçümseyen veya duyguyu geçersizleştiren gaslighting-benzeri dil sinyalleri var; bu klinik bir teşhis değildir.`, 0.65, gas.length / 6, gas.map(i => evidence(i, 'geçersizleştirme/gerçeklik bozma benzeri ifade')), mine.filter(i => i.repairScore > 0.8).map(i => evidence(i, 'karşı kanıt: sorumluluk/onarım')), { count: gas.length }, person, participants.find(p => p !== person)));
    }
  });

  if (a && b) {
    const repairA = insights.filter(i => i.speaker === a && i.repairScore > 0.5).length;
    const repairB = insights.filter(i => i.speaker === b && i.repairScore > 0.5).length;
    const emotionalA = insights.filter(i => i.speaker === a && (i.repairScore + i.signals.emotionalOpenness.score + (i.hasQuestion ? 1 : 0)) > 1).length;
    const emotionalB = insights.filter(i => i.speaker === b && (i.repairScore + i.signals.emotionalOpenness.score + (i.hasQuestion ? 1 : 0)) > 1).length;
    const diff = Math.abs(repairA - repairB);
    if (diff >= 3) {
      const more = repairA > repairB ? a : b;
      const less = repairA > repairB ? b : a;
      patterns.push(pattern('repair_imbalance', `Tartışma/onarma tarafında ${more} daha çok adım atıyor; ${less} tarafında sorumluluk alma daha sınırlı görünüyor.`, 0.7, diff / 10, insights.filter(i => i.speaker === more && i.repairScore > 0.5).slice(0, 5).map(i => evidence(i, 'onarım/sorumluluk örneği')), insights.filter(i => i.speaker === less && i.repairScore > 0.5).slice(0, 3).map(i => evidence(i, 'karşı taraftan onarım örneği')), { [a]: repairA, [b]: repairB }, less, more));
    }
    if (Math.abs(emotionalA - emotionalB) >= 6) {
      const carrier = emotionalA > emotionalB ? a : b;
      patterns.push(pattern('emotional_labor_imbalance', `${carrier} ilişkiyi açıklama, soru sorma veya toparlama tarafında daha fazla taşıyor olabilir.`, 0.62, Math.abs(emotionalA - emotionalB) / 16, insights.filter(i => i.speaker === carrier && (i.repairScore > 0.5 || i.hasQuestion)).slice(0, 5).map(i => evidence(i, 'duygusal emek örneği')), [], { [a]: emotionalA, [b]: emotionalB }, participants.find(p => p !== carrier), carrier));
    }
  }

  const future = insights.filter(i => i.signals.futureTalk.score > 0.7);
  const cancellations = insights.filter(i => i.signals.cancellation.score > 0.5);
  if (future.length >= 3 && cancellations.length >= 2) {
    patterns.push(pattern('future_faking_like', 'Gelecek/plan vaadi sinyalleri var ama iptal/erteleme de tekrar ediyor; “future faking-like” sinyal olarak dikkat çekiyor.', 0.58, (future.length + cancellations.length) / 12, [...future.slice(0, 2), ...cancellations.slice(0, 3)].map(i => evidence(i, 'vaat veya takip etmeyen plan sinyali')), [], { futureTalk: future.length, cancellations: cancellations.length }));
  }

  return patterns.sort((x, y) => (y.confidence + y.severity) - (x.confidence + x.severity)).slice(0, 12);
};

const metrics = (analysis: AnalysisResult, insights: MessageInsight[], patterns: RelationshipPattern[]): ConversationProfile['globalMetrics'] => {
  const participants = analysis.participants.map(p => p.name).slice(0, 2);
  const counts = participants.map(p => insights.filter(i => i.speaker === p).length);
  const shares = counts.map(c => c / Math.max(1, insights.length));
  const replyAvgs = participants.map(p => avg(insights.filter(i => i.speaker === p).map(i => i.replyDelayMinutes || 0).filter(Boolean)));
  const repairCounts = participants.map(p => insights.filter(i => i.speaker === p && i.repairScore > 0.5).length);
  return {
    reciprocityScore: clamp(1 - Math.abs((shares[0] || 0) - (shares[1] || 0))),
    initiativeBalance: clamp(1 - Math.abs((analysis.participants[0]?.initiations || 0) - (analysis.participants[1]?.initiations || 0)) / Math.max(1, insights.length)),
    affectionConsistency: clamp(1 - Math.min(1, Math.abs(avg(insights.slice(0, Math.floor(insights.length / 2)).map(i => i.warmthScore)) - avg(insights.slice(Math.floor(insights.length / 2)).map(i => i.warmthScore))))),
    conflictIntensity: clamp(avg(insights.map(i => i.conflictScore)) / 3),
    conflictRecoverySpeed: clamp(avg(insights.filter(i => i.repairScore > 0.5).map(i => i.repairScore)) / 3),
    responseLatencyAsymmetry: clamp(Math.abs((replyAvgs[0] || 0) - (replyAvgs[1] || 0)) / 720),
    repairBalance: clamp(1 - Math.abs((repairCounts[0] || 0) - (repairCounts[1] || 0)) / Math.max(1, repairCounts[0] + repairCounts[1])),
    emotionalLaborImbalance: patterns.some(p => p.type === 'emotional_labor_imbalance') ? patterns.find(p => p.type === 'emotional_labor_imbalance')!.severity : 0,
    avoidanceScore: clamp(avg(insights.map(i => i.avoidanceScore)) / 2),
    controlJealousyRisk: clamp(avg(insights.map(i => i.controlScore)) / 2),
    hotColdScore: patterns.find(p => p.type === 'hot_cold_cycle')?.severity || 0,
    ghostingRisk: patterns.find(p => p.type === 'slow_fade')?.severity || clamp(analysis.nlpSignals.totals.longSilences / 8),
    oneSidednessScore: clamp(1 - (1 - Math.abs((shares[0] || 0) - (shares[1] || 0)))),
  };
};

export const buildConversationProfile = (analysis: AnalysisResult): ConversationProfile => {
  const key = cacheKey(analysis.normalizedMessages);
  const cached = cache.get(key);
  if (cached) return cached;

  const insights = buildInsights(analysis);
  const episodes = extractRelationshipEpisodes(insights);
  const patterns = detectAdvancedPatterns(analysis, insights);
  const weeklyTrends = groupByPeriod(insights, 'week');
  const monthlyTrends = groupByPeriod(insights, 'month');
  const profile: ConversationProfile = {
    dateRange: {
      start: analysis.dateRange.start.toISOString().slice(0, 10),
      end: analysis.dateRange.end.toISOString().slice(0, 10),
    },
    totalMessages: analysis.totalMessages,
    participantStats: participantStats(analysis, insights),
    relationshipPhases: monthlyTrends.map(row => ({
      period: String(row.period),
      label: Number(row.warmth) > Number(row.conflict) + Number(row.avoidance) ? 'yakınlık dönemi' : Number(row.conflict) > 0.7 ? 'gerilim dönemi' : Number(row.avoidance) > 0.5 ? 'geri çekilme dönemi' : 'dengeli/sakin dönem',
      dominantSignals: ['warmth', 'conflict', 'avoidance'].sort((x, y) => Number(row[y]) - Number(row[x])).slice(0, 2),
      summary: `${row.period}: sıcaklık ${row.warmth}, gerilim ${row.conflict}, kaçınma ${row.avoidance}.`,
    })),
    weeklyTrends,
    monthlyTrends,
    globalMetrics: metrics(analysis, insights, patterns),
    topPatterns: patterns,
    keyEpisodes: episodes,
    messageInsights: insights,
  };
  cache.set(key, profile);
  return profile;
};
