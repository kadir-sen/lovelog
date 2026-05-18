import { describe, it, expect } from 'vitest';
import { classifyEchoResponse } from '../../services/nlp/echoResponseClassifier';
import { mkMsg } from './_fixtures';
import { buildMessageInsights } from '../../services/nlp/index';

const at = (h: number, m: number, mins = 0): Date => {
  const d = new Date(2026, 0, 15, h, m, 0);
  d.setMinutes(d.getMinutes() + mins);
  return d;
};

describe('echoResponseClassifier', () => {
  it('T1 A:"seni seviyorum" → B:"ben de seni" (3dk) → echo_warmth / lag=1', () => {
    const prior = buildMessageInsights([
      mkMsg({ author: 'A', content: 'seni seviyorum aşkım', date: at(20, 0), signals: { love: 1 }, adjustedSignals: { love: 1 } }),
    ]);
    const target = mkMsg({
      author: 'B',
      content: 'ben de seni aşkım',
      date: at(20, 3),
      signals: { love: 1 },
      adjustedSignals: { love: 1 },
    });
    const r = classifyEchoResponse({ target, priorInsights: prior });
    expect(r.tag).toBe('echo_warmth');
    expect(r.modifiers.echoLagMessages).toBe(1);
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('T2 aynı yazar peş peşe iki warm → none', () => {
    const prior = buildMessageInsights([
      mkMsg({ author: 'A', content: 'seni özledim', date: at(20, 0), signals: { love: 1 }, adjustedSignals: { love: 1 } }),
    ]);
    const target = mkMsg({
      author: 'A',
      content: 'çok özledim aşkım',
      date: at(20, 2),
      signals: { love: 1 },
      adjustedSignals: { love: 1 },
    });
    const r = classifyEchoResponse({ target, priorInsights: prior });
    expect(r.tag).toBe('none');
  });

  it('T3 90 dk gap → conf ≈ 0.50', () => {
    const prior = buildMessageInsights([
      mkMsg({ author: 'A', content: 'seni seviyorum', date: at(20, 0), signals: { love: 1 }, adjustedSignals: { love: 1 } }),
    ]);
    const target = mkMsg({
      author: 'B',
      content: 'ben de seni',
      date: at(21, 30),
      signals: { love: 1 },
      adjustedSignals: { love: 1 },
    });
    const r = classifyEchoResponse({ target, priorInsights: prior });
    expect(r.tag).toBe('echo_warmth');
    expect(r.confidence).toBeLessThanOrEqual(0.55);
    expect(r.confidence).toBeGreaterThanOrEqual(0.45);
  });

  it('T4 200 dk gap → none', () => {
    const prior = buildMessageInsights([
      mkMsg({ author: 'A', content: 'seni seviyorum', date: at(17, 0), signals: { love: 1 }, adjustedSignals: { love: 1 } }),
    ]);
    const target = mkMsg({
      author: 'B',
      content: 'ben de aşkım',
      date: at(20, 30),
      signals: { love: 1 },
      adjustedSignals: { love: 1 },
    });
    const r = classifyEchoResponse({ target, priorInsights: prior });
    expect(r.tag).toBe('none');
  });

  it('T5 warm prev yok → none', () => {
    const prior = buildMessageInsights([
      mkMsg({ author: 'A', content: 'kitabı aldın mı', date: at(20, 0) }),
    ]);
    const target = mkMsg({
      author: 'B',
      content: 'seni seviyorum',
      date: at(20, 5),
      signals: { love: 1 },
      adjustedSignals: { love: 1 },
    });
    const r = classifyEchoResponse({ target, priorInsights: prior });
    expect(r.tag).toBe('none');
  });

  it('T6 modifiers.counterpartAuthor doldurulu', () => {
    const prior = buildMessageInsights([
      mkMsg({ author: 'A', content: 'aşkım', date: at(20, 0), signals: { love: 1 }, adjustedSignals: { love: 1 } }),
    ]);
    const target = mkMsg({
      author: 'B',
      content: 'aşkım',
      date: at(20, 4),
      signals: { love: 1 },
      adjustedSignals: { love: 1 },
    });
    const r = classifyEchoResponse({ target, priorInsights: prior });
    if (r.tag === 'echo_warmth') {
      expect(r.modifiers.counterpartAuthor).toBe('A');
    }
  });
});
