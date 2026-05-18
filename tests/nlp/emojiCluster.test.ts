import { describe, it, expect } from 'vitest';
import { classifyEmojiCluster } from '../../services/nlp/emojiClusterClassifier';
import { buildContextWindowFor } from '../../services/nlp/contextWindow';
import { seq } from './_fixtures';

describe('emojiClusterClassifier', () => {
  it('T1 "😘😘" → emoji_cluster / same_repeat_2 / conf ≥ 0.6', () => {
    const msgs = seq([{ author: 'A', content: '😘😘' }]);
    const ctx = buildContextWindowFor(msgs, 0);
    const r = classifyEmojiCluster(ctx);
    expect(r.tag).toBe('emoji_cluster');
    expect(r.modifiers.clusterKind).toBe('same_repeat_2');
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('T2 "😙😙😙" → same_repeat_3plus / conf ≥ 0.75', () => {
    const msgs = seq([{ author: 'B', content: '😙😙😙' }]);
    const ctx = buildContextWindowFor(msgs, 0);
    const r = classifyEmojiCluster(ctx);
    expect(['same_repeat_3plus', 'kiss_burst']).toContain(r.modifiers.clusterKind);
    expect(r.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('T3 "❤️😘" → mixed_affection_pair (heart + kiss farklı aileler)', () => {
    const msgs = seq([{ author: 'A', content: '❤️😘' }]);
    const ctx = buildContextWindowFor(msgs, 0);
    const r = classifyEmojiCluster(ctx);
    expect(r.tag).toBe('emoji_cluster');
    expect(r.modifiers.clusterKind).toBe('mixed_affection_pair');
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('T4 "aşkım 🐬" → inside_joke_pattern / boundWarmTerm=aşkım', () => {
    const msgs = seq([{ author: 'A', content: 'aşkım 🐬' }]);
    const ctx = buildContextWindowFor(msgs, 0);
    const r = classifyEmojiCluster(ctx);
    expect(r.tag).toBe('inside_joke_pattern');
    expect(r.modifiers.boundWarmTerm).toBe('aşkım');
    expect(r.modifiers.customAffection).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('T5 "🥳🥳🥳🥳🥳" → celebration_burst / bursting=true', () => {
    const msgs = seq([{ author: 'A', content: '🥳🥳🥳🥳🥳' }]);
    const ctx = buildContextWindowFor(msgs, 0);
    const r = classifyEmojiCluster(ctx);
    // celebration_burst de aynı zamanda same_repeat_3plus eşleşmesi;
    // ilk eşleşen yakalanır, ama bursting kesinlikle true olmalı.
    expect(r.tag).toBe('emoji_cluster');
    expect(r.modifiers.bursting).toBe(true);
    expect(r.modifiers.clusterSize).toBe(5);
  });

  it('T6 tek emoji "😘" → none', () => {
    const msgs = seq([{ author: 'A', content: '😘' }]);
    const ctx = buildContextWindowFor(msgs, 0);
    const r = classifyEmojiCluster(ctx);
    expect(r.tag).toBe('none');
  });

  it('T7 karışık burst "😘😙😚❤️🥰🤍" → bursting=true + cluster', () => {
    const msgs = seq([{ author: 'A', content: '😘😙😚❤️🥰🤍' }]);
    const ctx = buildContextWindowFor(msgs, 0);
    const r = classifyEmojiCluster(ctx);
    expect(r.modifiers.bursting).toBe(true);
    expect(r.modifiers.clusterSize).toBeGreaterThanOrEqual(5);
    expect(r.tag).toBe('emoji_cluster');
  });
});
