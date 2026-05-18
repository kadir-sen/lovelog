import { describe, it, expect } from 'vitest';
import { classifyLaugh } from '../../services/nlp/laughClassifier';
import { buildContextWindowFor } from '../../services/nlp/contextWindow';
import { seq } from './_fixtures';

describe('laughClassifier', () => {
  it('komik playful prev sonrası "kkkk" → real_laugh', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'kankam tam senlik bir caps gönderdim 😂', playfulnessFlag: true },
      { author: 'Ayşe', content: 'kkkkk' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyLaugh(ctx).tag).toBe('real_laugh');
  });

  it('üzücü/duygusal prev sonrası küçük "heh" → awkward/defensive', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'ben artık bunu kaldıramıyorum', adjustedSignals: { emotional: 1, tension: 1 } },
      { author: 'Ayşe', content: 'heh' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    const r = classifyLaugh(ctx);
    expect(['awkward_laugh', 'defensive_laugh', 'softener_laugh']).toContain(r.tag);
  });

  it('🙄 + "kkk" → sarcastic_laugh', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'yine aynı şey', adjustedSignals: { tension: 1 } },
      { author: 'Ayşe', content: 'kkk 🙄' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyLaugh(ctx).tag).toBe('sarcastic_laugh');
  });

  it('flört prev + 😂 + ❤️ → flirty_laugh', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'seni öpmek istiyorum şimdi 😘', playfulnessFlag: true },
      { author: 'Ayşe', content: 'kkk seni öyle 😂❤️' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    const r = classifyLaugh(ctx);
    expect(['flirty_laugh', 'real_laugh']).toContain(r.tag);
  });

  it('hiç gülme yoksa "none"', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'buluşalım mı yarın' },
      { author: 'Ayşe', content: 'okey görüşürüz' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyLaugh(ctx).tag).toBe('none');
  });
});
