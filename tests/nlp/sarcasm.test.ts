import { describe, it, expect } from 'vitest';
import { detectSarcasm } from '../../services/nlp/sarcasmModifier';
import { buildContextWindowFor } from '../../services/nlp/contextWindow';
import { seq } from './_fixtures';

describe('sarcasmModifier', () => {
  it('"tabii canım 🙄" + prev conflict → sarcasm_possible (conf yüksek)', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'bunu hep yapıyorsun ya', adjustedSignals: { harsh: 1, tension: 1 } },
      { author: 'Ayşe', content: 'tabii canım 🙄' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    const r = detectSarcasm(ctx);
    expect(r.tag).toBe('sarcasm_possible');
    expect(r.confidence).toBeGreaterThanOrEqual(0.55);
  });

  it('"tabii canım" + playful prev → sarcasm değil, humor_playful', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'kkkk çok komiksin', playfulnessFlag: true },
      { author: 'Ayşe', content: 'tabii canım 😂' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    const r = detectSarcasm(ctx);
    expect(r.tag === 'humor_playful' || r.tag === 'none').toBe(true);
  });

  it('"bravo gerçekten" + prev kavga → sarcasm_possible', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'yine geç kaldın yine', adjustedSignals: { harsh: 1, tension: 1 } },
      { author: 'Ayşe', content: 'bravo gerçekten' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    const r = detectSarcasm(ctx);
    expect(['sarcasm_possible', 'positive_literal_but_negative_context']).toContain(r.tag);
  });

  it('"süpppersin ya" intensifier-drag → sarcasm boost', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'sen hep böylesin', adjustedSignals: { tension: 1 } },
      { author: 'Ayşe', content: 'süpppersin ya' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    const r = detectSarcasm(ctx);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('"süpersin canım ❤️" + playful prev → sarcasm yok', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'sen tatlısın', adjustedSignals: { love: 1 }, signals: { love: 1 } },
      { author: 'Ayşe', content: 'süpersin canım ❤️' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    const r = detectSarcasm(ctx);
    expect(r.tag).not.toBe('sarcasm_possible');
  });

  it('🙄 tek başına + prev conflict → sarcasm', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'yine başlama', adjustedSignals: { tension: 1 } },
      { author: 'Ayşe', content: 'tamam 🙄' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    const r = detectSarcasm(ctx);
    expect(r.tag).toBe('sarcasm_possible');
  });
});
