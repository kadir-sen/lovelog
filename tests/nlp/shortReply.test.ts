import { describe, it, expect } from 'vitest';
import { classifyShortReply } from '../../services/nlp/shortReplyClassifier';
import { buildContextWindowFor } from '../../services/nlp/contextWindow';
import { seq } from './_fixtures';

describe('shortReplyClassifier', () => {
  it('"tamam aşkım" → warm_ack', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'yarın görüşelim mi?' },
      { author: 'Ayşe', content: 'tamam aşkım' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyShortReply(ctx).tag).toBe('warm_ack');
  });

  it('uzun-duygusal prev sonrası "tamam." → cold_ack', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'beni hiç dinlemiyorsun zaten, hep böyle yapıyorsun, ben de bıktım artık', adjustedSignals: { tension: 1, harsh: 1 } },
      { author: 'Ayşe', content: 'tamam.' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyShortReply(ctx).tag).toBe('cold_ack');
  });

  it('nötr prev sonrası "tamam" → neutral_ack (withdrawal değil)', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'kitabı ofise bıraktım yarın alabilirsin' },
      { author: 'Ayşe', content: 'tamam' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyShortReply(ctx).tag).toBe('neutral_ack');
  });

  it('"peki :)" + prev kavga → passive_aggressive_possible', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'sen ne diyorsun olmuyor böyle', adjustedSignals: { tension: 1 } },
      { author: 'Ayşe', content: 'peki :)' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyShortReply(ctx).tag).toBe('passive_aggressive_possible');
  });

  it('"konuşmak istemiyorum" → withdrawal_possible', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'lütfen konuşalım' },
      { author: 'Ayşe', content: 'şu an konuşmak istemiyorum' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyShortReply(ctx).tag).toBe('withdrawal_possible');
  });

  it('"yazma bana" → conflict_shutdown', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'lütfen barışalım' },
      { author: 'Ayşe', content: 'yazma bana' },
    ]);
    const ctx = buildContextWindowFor(msgs, 1);
    expect(classifyShortReply(ctx).tag).toBe('conflict_shutdown');
  });
});
