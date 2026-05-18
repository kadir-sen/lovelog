import { describe, it, expect } from 'vitest';
import { classifyControlPressure } from '../../services/nlp/controlPressureClassifier';
import { buildContextWindowFor } from '../../services/nlp/contextWindow';
import { seq } from './_fixtures';

describe('controlPressureClassifier', () => {
  it('"eve vardın mı" → care_checkin', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'yatıyorum hadi' },
      { author: 'Ayşe', content: 'eve vardın mı?' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyControlPressure(ctx).tag).toBe('care_checkin');
  });

  it('"iyi misin?" tek başına → care_checkin', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'biraz yoruldum bugün', adjustedSignals: { emotional: 1 } },
      { author: 'Ayşe', content: 'iyi misin?' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    const r = classifyControlPressure(ctx);
    // Önceki "biraz yoruldum" emotional ama conflict değil; care_checkin beklenir
    expect(['care_checkin', 'neutral_question']).toContain(r.tag);
  });

  it('"konum at" → control_pressure', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'neredesin sen' },
      { author: 'Ali',  content: 'konum at hemen' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyControlPressure(ctx).tag).toBe('control_pressure');
  });

  it('"cevap versene" + imperative → control_pressure', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'cevap versene!!' },
    ]);
    const ctx = buildContextWindowFor(msgs, 0);
    expect(classifyControlPressure(ctx).tag).toBe('control_pressure');
  });

  it('"neredesin?" tek başına → neutral_question (NOT control)', () => {
    const msgs = seq([
      { author: 'Ayşe', content: 'günaydın' },
      { author: 'Ali',  content: 'neredesin?' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    const r = classifyControlPressure(ctx);
    expect(['neutral_question', 'care_checkin']).toContain(r.tag);
  });

  it('"kim o" — prev conflict → jealousy_check', () => {
    const msgs = seq([
      { author: 'Ayşe', content: 'arkadaşım yazdı', adjustedSignals: { tension: 1 } },
      { author: 'Ali',  content: 'kim o?' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyControlPressure(ctx).tag).toBe('jealousy_check');
  });
});
