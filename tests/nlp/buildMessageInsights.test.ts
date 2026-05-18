import { describe, it, expect } from 'vitest';
import { buildMessageInsights, extractEpisodes } from '../../services/nlp/index';
import { seq } from './_fixtures';

describe('buildMessageInsights — orchestration', () => {
  it('boş input → boş output', () => {
    expect(buildMessageInsights([])).toEqual([]);
  });

  it('mesaj başına EnrichedInsight üretir, isMedia atlanır', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'seni seviyorum' },
      { author: 'Ayşe', content: 'ben de aşkım ❤️' },
      { author: 'Ali',  content: '<medya>', isMedia: true },
      { author: 'Ali',  content: 'yarın görüşelim mi' },
    ]);
    const insights = buildMessageInsights(msgs);
    expect(insights.length).toBe(3);
    expect(insights[0].confidenceOverall).toBeGreaterThanOrEqual(0);
  });

  it('negation: seni sevmiyorum → affection score 0', () => {
    const msgs = seq([
      { author: 'Ali', content: 'seni sevmiyorum' },
    ]);
    const ins = buildMessageInsights(msgs)[0];
    expect(ins.signals.affection.negated).toBe(true);
    expect(ins.signals.affection.score).toBe(0);
  });

  it('sarcasm: prev conflict + "tabii canım" → sarcasm modifier set', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'yine geç kaldın', adjustedSignals: { tension: 1 } },
      { author: 'Ayşe', content: 'tabii canım 🙄' },
    ]);
    const ins = buildMessageInsights(msgs)[1];
    expect(ins.modifiers.sarcasm).toBe(true);
  });

  it('episodes extract çağrısı insights üzerinden yapılabilir', () => {
    const msgs = seq([
      { author: 'Ali',  content: 'salak mısın yine', adjustedSignals: { harsh: 1, tension: 1 } },
      { author: 'Ali',  content: 'her şeyi mahvediyorsun', adjustedSignals: { harsh: 1 } },
      { author: 'Ayşe', content: 'özür dilerim haklısın', signals: { apology: 1 } },
    ]);
    const insights = buildMessageInsights(msgs);
    const episodes = extractEpisodes(insights);
    expect(Array.isArray(episodes)).toBe(true);
  });

  it('AnnotationLabel uyumlu DialogueAct seti boş değil', () => {
    const msgs = seq([
      { author: 'Ali', content: 'eve vardın mı?', hasQuestion: true },
    ]);
    const ins = buildMessageInsights(msgs)[0];
    expect(ins.dialogueActs.length).toBeGreaterThan(0);
  });
});
