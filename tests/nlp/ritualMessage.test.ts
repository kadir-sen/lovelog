import { describe, it, expect } from 'vitest';
import { classifyRitual } from '../../services/nlp/ritualMessageClassifier';
import { buildContextWindowFor } from '../../services/nlp/contextWindow';
import { mkMsg } from './_fixtures';

const at = (h: number, m: number) => new Date(2026, 0, 15, h, m, 0);

describe('ritualMessageClassifier', () => {
  it('T1 good_night @ 23:00 → in-window / conf ≈ 0.75', () => {
    const msgs = [mkMsg({ author: 'A', content: 'iyi geceler', date: at(23, 0) })];
    const r = classifyRitual(buildContextWindowFor(msgs, 0));
    expect(r.tag).toBe('ritual_message');
    expect(r.modifiers.ritualKind).toBe('good_night');
    expect(r.modifiers.inExpectedWindow).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('T2 good_night @ 09:00 → out-of-window / conf ≈ 0.40 / counterEvidence var', () => {
    const msgs = [mkMsg({ author: 'A', content: 'iyi geceler', date: at(9, 0) })];
    const r = classifyRitual(buildContextWindowFor(msgs, 0));
    expect(r.tag).toBe('ritual_message');
    expect(r.modifiers.inExpectedWindow).toBe(false);
    expect(r.confidence).toBeLessThanOrEqual(0.45);
    expect(r.counterEvidence.length).toBeGreaterThan(0);
  });

  it('T3 günaydın @ 07:30 → morning in-window', () => {
    const msgs = [mkMsg({ author: 'A', content: 'günaydın canım', date: at(7, 30) })];
    const r = classifyRitual(buildContextWindowFor(msgs, 0));
    expect(r.modifiers.ritualKind).toBe('good_morning');
    expect(r.modifiers.timeOfDay).toBe('morning');
    expect(r.modifiers.inExpectedWindow).toBe(true);
  });

  it('T4 kolay gelsin @ 14:00 → day, conf ≈ 0.55', () => {
    const msgs = [mkMsg({ author: 'B', content: 'kolay gelsin', date: at(14, 0) })];
    const r = classifyRitual(buildContextWindowFor(msgs, 0));
    expect(r.modifiers.ritualKind).toBe('easy_does_it');
    expect(r.modifiers.timeOfDay).toBe('day');
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('T5 tatlı rüyalar @ 23:30 → night, en yüksek warmth', () => {
    const msgs = [mkMsg({ author: 'A', content: 'tatlı rüyalar aşkım', date: at(23, 30) })];
    const r = classifyRitual(buildContextWindowFor(msgs, 0));
    expect(r.modifiers.ritualKind).toBe('sweet_dreams');
    expect(r.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('T6 "evet tamam" → none', () => {
    const msgs = [mkMsg({ author: 'A', content: 'evet tamam', date: at(14, 0) })];
    const r = classifyRitual(buildContextWindowFor(msgs, 0));
    expect(r.tag).toBe('none');
  });

  it('T7 modifier yapısı doldurulu', () => {
    const msgs = [mkMsg({ author: 'A', content: 'iyi geceler', date: at(23, 0) })];
    const r = classifyRitual(buildContextWindowFor(msgs, 0));
    expect(r.modifiers.ritualKind).toBeDefined();
    expect(r.modifiers.timeOfDay).toBeDefined();
    expect(typeof r.modifiers.inExpectedWindow).toBe('boolean');
  });
});
