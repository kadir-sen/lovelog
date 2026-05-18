import { describe, it, expect } from 'vitest';
import { buildStyleProfile, DEFAULT_STYLE_PROFILE } from '../../services/nlp/styleProfile';
import { seq } from './_fixtures';

describe('styleProfile', () => {
  it('en aktif iki yazarı A ve B olarak ranklar', () => {
    const msgs = seq([
      ...Array.from({ length: 10 }, (_, i) => ({ author: 'Ali', content: `mesaj ${i}` })),
      ...Array.from({ length: 6 },  (_, i) => ({ author: 'Ayşe', content: `naber ${i}` })),
      { author: 'Mehmet', content: 'ben buradayım' },
    ]);
    const sp = buildStyleProfile(msgs);
    expect(sp.authors.A.avgMessageLength).toBeGreaterThan(0);
    expect(sp.authors.B.avgMessageLength).toBeGreaterThan(0);
  });

  it('warm term kullanımı verbose author için raporlanır', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'aşkım bugün nasılsın canım' },
      { author: 'Ali',  content: 'seni özledim hayatım' },
      { author: 'Ayşe', content: 'ben de seni' },
    ]);
    const sp = buildStyleProfile(msgs);
    expect(sp.authors.A.warmTermUsage.length).toBeGreaterThan(0);
  });

  it('emoji semantik default profilde tanımlı', () => {
    expect(DEFAULT_STYLE_PROFILE.relationshipDialect.emojiSemantics['😂']).toContain('humor');
    expect(DEFAULT_STYLE_PROFILE.relationshipDialect.emojiSemantics['❤']).toContain('affection');
    expect(DEFAULT_STYLE_PROFILE.relationshipDialect.emojiSemantics['🙄']).toContain('sarcasm');
  });

  it('warmTerms default dialect içinde mevcut', () => {
    expect(DEFAULT_STYLE_PROFILE.relationshipDialect.warmTerms).toContain('aşkım');
    expect(DEFAULT_STYLE_PROFILE.relationshipDialect.warmTerms).toContain('canım');
  });

  it('inside joke candidates: tekrarlı harf paternleri', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'aaaa ne diyim sana' },
      { author: 'Ali',  content: 'mmmmm güzel olmuş' },
      { author: 'Ayşe', content: 'yyyyyy süper' },
    ]);
    const sp = buildStyleProfile(msgs);
    expect(sp.relationshipDialect.insideJokeCandidates.length).toBeGreaterThan(0);
  });

  it('PR-9: emojiPairFrequency ve ritualTimeDistribution doldurulu', () => {
    const at = (h: number) => new Date(2026, 0, 15, h, 0, 0);
    const msgs = seq([
      { author: 'A', content: '😘😘 aşkım', date: at(20) },
      { author: 'A', content: '😘😘😘', date: at(20) },
      { author: 'A', content: 'iyi geceler', date: at(23) },
      { author: 'B', content: 'iyi geceler aşkım', date: at(23) },
      { author: 'B', content: 'günaydın', date: at(8) },
    ]);
    const sp = buildStyleProfile(msgs);
    expect(sp.relationshipDialect.emojiPairFrequency).toBeDefined();
    expect(sp.relationshipDialect.emojiPairFrequency!.length).toBeGreaterThan(0);
    expect(sp.relationshipDialect.ritualTimeDistribution).toBeDefined();
    expect(sp.relationshipDialect.ritualTimeDistribution!.good_night).toBeDefined();
    expect(sp.relationshipDialect.ritualTimeDistribution!.good_night.night).toBeGreaterThanOrEqual(1);
  });

  it('PR-9: authorAffectionLeaning + customAffectionEmojis', () => {
    const msgs = seq([
      { author: 'A', content: '😘 aşkım' },
      { author: 'A', content: '😘 canım' },
      { author: 'A', content: 'aşkım 🐬' },
      { author: 'B', content: '😙 bitanem' },
      { author: 'B', content: '😙' },
    ]);
    const sp = buildStyleProfile(msgs);
    expect(sp.relationshipDialect.authorAffectionLeaning).toBeDefined();
    expect(sp.relationshipDialect.authorAffectionLeaning!.A.dominantEmoji).toBe('😘');
    expect(sp.relationshipDialect.authorAffectionLeaning!.B.dominantEmoji).toBe('😙');
    expect(sp.relationshipDialect.customAffectionEmojis).toContain('🐬');
  });
});
