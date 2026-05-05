import { EvidenceItem, MessageInsight, RelationshipEpisode, RelationshipSignalKey } from '../types';

const toEvidence = (m: MessageInsight, reason: string): EvidenceItem => ({
  messageId: m.messageId,
  timestamp: m.timestamp,
  speaker: m.speaker,
  quoteMasked: m.textMasked,
  reason,
});

const dominantSignals = (items: MessageInsight[]): RelationshipSignalKey[] => {
  const totals: Partial<Record<RelationshipSignalKey, number>> = {};
  items.forEach(item => {
    Object.entries(item.signals).forEach(([key, detail]) => {
      totals[key as RelationshipSignalKey] = (totals[key as RelationshipSignalKey] || 0) + detail.score;
    });
  });
  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([key]) => key as RelationshipSignalKey);
};

const gapMinutes = (a: MessageInsight, b: MessageInsight): number =>
  (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) / 60000;

export const extractRelationshipEpisodes = (insights: MessageInsight[]): RelationshipEpisode[] => {
  const episodes: RelationshipEpisode[] = [];
  if (insights.length < 2) return episodes;

  let conflictCluster: MessageInsight[] = [];
  const flushConflict = () => {
    if (conflictCluster.length < 2) {
      conflictCluster = [];
      return;
    }
    const repair = insights.find(m =>
      new Date(m.timestamp) > new Date(conflictCluster[conflictCluster.length - 1].timestamp) &&
      m.repairScore > 0.8 &&
      gapMinutes(conflictCluster[conflictCluster.length - 1], m) < 1440
    );
    episodes.push({
      id: `conflict-${episodes.length + 1}`,
      type: 'conflict',
      startTime: conflictCluster[0].timestamp,
      endTime: (repair || conflictCluster[conflictCluster.length - 1]).timestamp,
      participants: Array.from(new Set(conflictCluster.map(m => m.speaker))),
      summary: 'Gerilim, savunma veya sert dilin kümelendiği bir tartışma dönemi.',
      dominantSignals: dominantSignals(conflictCluster),
      severity: Math.min(1, conflictCluster.reduce((a, m) => a + m.conflictScore + m.controlScore, 0) / 10),
      confidence: Math.min(0.9, 0.45 + conflictCluster.length * 0.08),
      evidence: conflictCluster.slice(0, 4).map(m => toEvidence(m, 'tartışma sinyali')),
      counterEvidence: repair ? [toEvidence(repair, 'sonrasında onarım sinyali')] : [],
    });
    if (repair) {
      episodes.push({
        id: `repair-${episodes.length + 1}`,
        type: 'repair',
        startTime: repair.timestamp,
        endTime: repair.timestamp,
        participants: [repair.speaker],
        summary: 'Tartışma sonrası özür, sorumluluk alma veya yumuşatma denemesi.',
        dominantSignals: dominantSignals([repair]),
        severity: Math.min(1, repair.repairScore / 4),
        confidence: 0.72,
        evidence: [toEvidence(repair, 'onarım mesajı')],
        counterEvidence: [],
      });
    }
    conflictCluster = [];
  };

  insights.forEach((item, index) => {
    const prev = insights[index - 1];
    if (prev && gapMinutes(prev, item) > 360) flushConflict();
    if (item.conflictScore + item.controlScore > 1.2) conflictCluster.push(item);
    else if (conflictCluster.length && item.repairScore > 0.7) {
      conflictCluster.push(item);
      flushConflict();
    }

    if (prev && gapMinutes(prev, item) >= 24 * 60 && prev.warmthScore + prev.repairScore + prev.conflictScore > 1) {
      episodes.push({
        id: `ghosting-gap-${episodes.length + 1}`,
        type: 'ghosting_gap',
        startTime: prev.timestamp,
        endTime: item.timestamp,
        participants: [prev.speaker, item.speaker],
        summary: `Duygusal olarak anlamlı bir mesajdan sonra yaklaşık ${Math.round(gapMinutes(prev, item) / 60)} saatlik boşluk var.`,
        dominantSignals: dominantSignals([prev, item]),
        severity: Math.min(1, gapMinutes(prev, item) / (72 * 60)),
        confidence: 0.65,
        evidence: [toEvidence(prev, 'boşluk öncesi mesaj'), toEvidence(item, 'boşluk sonrası dönüş')],
        counterEvidence: item.warmthScore > 0 ? [toEvidence(item, 'dönüşte sıcaklık sinyali')] : [],
      });
    }

    if (item.signals.cancellation.score > 0.5) {
      const plan = insights.slice(Math.max(0, index - 12), index).reverse().find(m => m.signals.planning.score > 0.5);
      if (plan) {
        episodes.push({
          id: `plan-cancel-${episodes.length + 1}`,
          type: 'plan_cancel',
          startTime: plan.timestamp,
          endTime: item.timestamp,
          participants: [plan.speaker, item.speaker],
          summary: 'Plan yapıldıktan sonra iptal/erteleme sinyali görülüyor.',
          dominantSignals: ['planning', 'cancellation'],
          severity: 0.55,
          confidence: 0.7,
          evidence: [toEvidence(plan, 'plan sinyali'), toEvidence(item, 'iptal/erteleme sinyali')],
          counterEvidence: [],
        });
      }
    }

    if (/ayrılalım|bitirelim|görüşmeyelim|hoşça kal|istemiyorum artık/iu.test(item.textMasked)) {
      episodes.push({
        id: `goodbye-${episodes.length + 1}`,
        type: 'breakup_or_goodbye',
        startTime: item.timestamp,
        endTime: item.timestamp,
        participants: [item.speaker],
        summary: 'Bitirme, veda veya uzaklaşma mesajı.',
        dominantSignals: dominantSignals([item]),
        severity: 0.8,
        confidence: 0.75,
        evidence: [toEvidence(item, 'veda/bitirme ifadesi')],
        counterEvidence: [],
      });
    }
  });
  flushConflict();

  return episodes.sort((a, b) => b.severity - a.severity).slice(0, 24);
};
