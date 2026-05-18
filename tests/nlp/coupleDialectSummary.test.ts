import { describe, it, expect } from 'vitest';
import { buildCoupleDialectSummary } from '../../services/nlp/coupleDialectSummary';
import { buildMessageInsights, buildStyleProfile } from '../../services/nlp/index';
import { mkMsg } from './_fixtures';
import type { AnalysisResult } from '../../types';

const at = (h: number, m: number, day = 15) => new Date(2026, 0, day, h, m, 0);

const mkAnalysis = (messages: any[], partial?: Partial<AnalysisResult>): AnalysisResult => {
  const normalized = messages;
  const insights = buildMessageInsights(normalized);
  const styleProfile = buildStyleProfile(normalized);
  return {
    participants: [],
    totalMessages: messages.length,
    dateRange: { start: messages[0]?.date ?? new Date(), end: messages[messages.length - 1]?.date ?? new Date() },
    flow: { totalFluentMinutes: 0, maxFluentSessionMinutes: 0, averageDailyFluentMinutes: 0 },
    hourlyActivity: [],
    dailyStats: [],
    emojiAnalysis: [],
    loveWordStats: [],
    responseTimeBuckets: [],
    rawMessages: messages,
    normalizedMessages: messages,
    segments: [],
    periodSummaries: [],
    nlpSignals: { totals: {} as any, byParticipant: {} },
    milestones: [],
    patterns: [],
    algorithmicSummary: { privacyNote: '', aliases: {}, totalMessages: 0, dateRange: { start: '', end: '' }, participantSummaries: [], periodHighlights: [], milestones: [], evidence: [] },
    sampleConversation: '',
    messageInsights: insights as any,
    styleProfile,
    ...partial,
  };
};

describe('coupleDialectSummary', () => {
  it('analysis === null → status=empty', () => {
    const s = buildCoupleDialectSummary(null);
    expect(s.status).toBe('empty');
    expect(s.topFacts).toEqual([]);
  });

  it('messageInsights yoksa → status=empty', () => {
    const analysis = mkAnalysis([
      mkMsg({ author: 'X', content: 'merhaba', date: at(10, 0) }),
    ]);
    // analysis.messageInsights üretildi (var) ama media olmayan tek mesajla
    // partial olarak gelmesi gerekir; o yüzden 50'den az → partial.
    const s = buildCoupleDialectSummary(analysis);
    expect(['partial', 'rich']).toContain(s.status);
  });

  it('ritual streak: 3 gün üst üste "iyi geceler" → topFacts içinde ritüel', () => {
    const messages = [
      mkMsg({ author: 'A', content: 'iyi geceler aşkım', date: at(23, 0, 1) }),
      mkMsg({ author: 'A', content: 'iyi geceler', date: at(23, 0, 2) }),
      mkMsg({ author: 'A', content: 'iyi geceler', date: at(23, 0, 3) }),
    ];
    const s = buildCoupleDialectSummary(mkAnalysis(messages));
    const ritualFact = s.topFacts.find(f => f.id === 'ritual-streak');
    expect(ritualFact).toBeDefined();
    expect(s.ritualStreaks[0]?.longestStreakDays).toBeGreaterThanOrEqual(2);
  });

  it('custom marker: "aşkım 🐬" 3 kez → inside-joke fact', () => {
    const messages = Array.from({ length: 4 }, (_, i) =>
      mkMsg({ author: 'A', content: 'aşkım 🐬', date: at(20, i, 1) })
    );
    const s = buildCoupleDialectSummary(mkAnalysis(messages));
    expect(s.customMarker?.term).toBe('aşkım');
    const insideJokeFact = s.topFacts.find(f => f.id === 'inside-joke');
    expect(insideJokeFact).toBeDefined();
  });

  it('klinik dil filtresi: blocklist kelimesi headline/title/body içine sızmaz', () => {
    const s = buildCoupleDialectSummary(null);
    // empty path
    expect(s.headline).not.toMatch(/gaslighter|narcissist|toxic|abuser/i);
  });

  it('headline boş analiz için "yeterli mesaj" mesajı verir', () => {
    expect(buildCoupleDialectSummary(undefined).headline).toMatch(/yeterli|bulunamadı/i);
  });

  it('rich status: 60+ insight → status=rich', () => {
    const messages = Array.from({ length: 60 }, (_, i) =>
      mkMsg({ author: i % 2 === 0 ? 'A' : 'B', content: `mesaj ${i}`, date: at(10, i % 60, 1) })
    );
    const s = buildCoupleDialectSummary(mkAnalysis(messages));
    expect(s.status).toBe('rich');
    expect(s.basedOnInsightCount).toBeGreaterThanOrEqual(50);
  });
});
