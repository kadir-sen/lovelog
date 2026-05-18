import { describe, it, expect } from 'vitest';
import { buildMessageInsights } from '../../services/nlp/index';
import { mkMsg } from './_fixtures';

const at = (h: number, m: number) => new Date(2026, 0, 15, h, m, 0);

describe('buildMessageInsights — couple-dialect modifiers (integration)', () => {
  it('T1 22:00 "iyi geceler aşkım" → timeOfDay=night, ritualKind=good_night', () => {
    const msgs = [mkMsg({ author: 'A', content: 'iyi geceler aşkım', date: at(22, 0) })];
    const [ins] = buildMessageInsights(msgs);
    expect(ins.modifiers.timeOfDay).toBe('night');
    expect(ins.modifiers.ritualKind).toBe('good_night');
    expect(ins.modifiers.ritualInExpectedWindow).toBe(true);
  });

  it('T2 08:00 "günaydın canım" → timeOfDay=morning', () => {
    const msgs = [mkMsg({ author: 'A', content: 'günaydın canım', date: at(8, 0) })];
    const [ins] = buildMessageInsights(msgs);
    expect(ins.modifiers.timeOfDay).toBe('morning');
    expect(ins.modifiers.ritualKind).toBe('good_morning');
  });

  it('T3 14:00 "kolay gelsin" → timeOfDay=day', () => {
    const msgs = [mkMsg({ author: 'B', content: 'kolay gelsin', date: at(14, 0) })];
    const [ins] = buildMessageInsights(msgs);
    expect(ins.modifiers.timeOfDay).toBe('day');
    expect(ins.modifiers.ritualKind).toBe('easy_does_it');
  });

  it('T4 ritual yok → modifier alanları undefined', () => {
    const msgs = [mkMsg({ author: 'A', content: 'kitabı aldın mı', date: at(14, 0) })];
    const [ins] = buildMessageInsights(msgs);
    expect(ins.modifiers.timeOfDay).toBeUndefined();
    expect(ins.modifiers.ritualKind).toBeUndefined();
  });

  it('T5 emoji cluster modifier doldurulu', () => {
    const msgs = [mkMsg({ author: 'A', content: '😘😘😘', date: at(20, 0) })];
    const [ins] = buildMessageInsights(msgs);
    expect(ins.modifiers.emojiCluster).toBeDefined();
    expect(ins.modifiers.emojiCluster?.size).toBe(3);
  });

  it('T6 inside_joke_pattern: aşkım × 🐬 yakalanır', () => {
    const msgs = [mkMsg({ author: 'A', content: 'aşkım 🐬', date: at(20, 0) })];
    const [ins] = buildMessageInsights(msgs);
    expect(ins.modifiers.emojiCluster?.customAffection).toBe(true);
    expect(ins.modifiers.emojiCluster?.boundWarmTerm).toBe('aşkım');
  });
});
