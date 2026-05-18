import { describe, it, expect } from 'vitest';
import { classifyIntensifierDrag } from '../../services/nlp/intensifierDragClassifier';
import { buildContextWindowFor } from '../../services/nlp/contextWindow';
import { seq } from './_fixtures';

describe('intensifierDragClassifier', () => {
  it('T1 "aşkımmmm" → intensified_endearment / onWarmTerm=true / conf ≥ 0.65', () => {
    const msgs = seq([{ author: 'A', content: 'aşkımmmm' }]);
    const r = classifyIntensifierDrag(buildContextWindowFor(msgs, 0));
    expect(r.tag).toBe('intensified_endearment');
    expect(r.modifiers.onWarmTerm).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it('T2 "tabiii canım" no-conflict → intensified_filler / conf ≈ 0.50', () => {
    const msgs = seq([{ author: 'A', content: 'tabiii canım' }]);
    const r = classifyIntensifierDrag(buildContextWindowFor(msgs, 0));
    expect(r.tag).toBe('intensified_filler');
    expect(r.modifiers.onFiller).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0.45);
  });

  it('T3 "tabiii canım" + prev conflict → none (sarcasm üstlenir)', () => {
    const msgs = seq([
      { author: 'B', content: 'yine geç kaldın', adjustedSignals: { tension: 1, harsh: 1 } },
      { author: 'A', content: 'tabiii canım' },
    ]);
    const r = classifyIntensifierDrag(buildContextWindowFor(msgs, 1));
    expect(r.tag).toBe('none');
  });

  it('T4 "bitanemmmm" (repeatLen=4) → ≈ 0.67', () => {
    const msgs = seq([{ author: 'A', content: 'bitanemmmm' }]);
    const r = classifyIntensifierDrag(buildContextWindowFor(msgs, 0));
    expect(r.tag).toBe('intensified_endearment');
    expect(r.modifiers.maxRepeatLen).toBeGreaterThanOrEqual(4);
    expect(r.confidence).toBeGreaterThanOrEqual(0.65);
    expect(r.confidence).toBeLessThanOrEqual(0.75);
  });

  it('T5 "çokkkk" tek başına → none (positive_adverb düşük signal)', () => {
    const msgs = seq([{ author: 'A', content: 'çokkkk güzel' }]);
    const r = classifyIntensifierDrag(buildContextWindowFor(msgs, 0));
    expect(r.tag).toBe('none');
  });

  it('T6 name_like base evidence.span maskelenmiş kategori olarak gelir', () => {
    const msgs = seq([{ author: 'A', content: 'sudemmmm' }]);
    const r = classifyIntensifierDrag(buildContextWindowFor(msgs, 0));
    expect(r.tag).toBe('none'); // name_like base → düşük signal
    expect(r.modifiers.dragHits[0]?.base).toBe('name_like');
  });

  it('T7 dragHits içinde repeatLen alanları doğru', () => {
    const msgs = seq([{ author: 'A', content: 'aşkımmm seviyorum çokkkk' }]);
    const r = classifyIntensifierDrag(buildContextWindowFor(msgs, 0));
    expect(r.modifiers.dragHits.length).toBeGreaterThanOrEqual(2);
    expect(r.modifiers.dragHits.every(h => h.repeatLen >= 3)).toBe(true);
  });
});
