// services/nlp/contextWindow.ts — NormalizedMessage[] üzerinde prev/next
// pencereleri üretir. Pure. Hiçbir state tutmaz; index başına window üretir.

import type { NormalizedMessage } from '../../types';
import type { ContextWindow } from './types';

const minutes = (a: Date, b: Date): number => (b.getTime() - a.getTime()) / 60000;

export interface BuildWindowsOptions {
  prev?: number;     // default 3
  next?: number;     // default 2
  /** Pencerede target olarak hangi mesajlar geçer; default = isMedia olmayan */
  includeMedia?: boolean;
}

export const buildContextWindowFor = (
  messages: NormalizedMessage[],
  index: number,
  options: BuildWindowsOptions = {}
): ContextWindow => {
  const p = options.prev ?? 3;
  const n = options.next ?? 2;
  const target = messages[index];
  const prev: NormalizedMessage[] = [];
  for (let j = index - 1; j >= 0 && prev.length < p; j--) prev.unshift(messages[j]);
  const next: NormalizedMessage[] = [];
  for (let j = index + 1; j < messages.length && next.length < n; j++) next.push(messages[j]);

  const gapBeforeMinutes = prev.length ? minutes(prev[prev.length - 1].date, target.date) : null;
  const gapAfterMinutes = next.length ? minutes(target.date, next[0].date) : null;

  return { prev, target, next, index, gapBeforeMinutes, gapAfterMinutes };
};

export const buildAllWindows = (
  messages: NormalizedMessage[],
  options: BuildWindowsOptions = {}
): ContextWindow[] => {
  const out: ContextWindow[] = [];
  const includeMedia = !!options.includeMedia;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!includeMedia && m.isMedia) continue;
    out.push(buildContextWindowFor(messages, i, options));
  }
  return out;
};

// --- Yardımcı sinyaller — context analizinin tek yerden okunması için ---

export const prevConflictLevel = (ctx: ContextWindow): number => {
  let score = 0;
  for (const p of ctx.prev) {
    if (p.adjustedSignals.harsh > 0) score += 2;
    if (p.adjustedSignals.tension > 0) score += 1;
    if (p.signals.jealousy > 0) score += 1;
  }
  return score;
};

export const prevAffectionLevel = (ctx: ContextWindow): number => {
  let score = 0;
  for (const p of ctx.prev) {
    if (p.adjustedSignals.love > 0) score += 1;
    if (p.adjustedSignals.emotional > 0) score += 1;
  }
  return score;
};

export const prevPlayLevel = (ctx: ContextWindow): number => {
  let score = 0;
  for (const p of ctx.prev) if (p.playfulnessFlag) score += 1;
  return score;
};

export const prevLastEmotionalLong = (ctx: ContextWindow): boolean => {
  const last = ctx.prev[ctx.prev.length - 1];
  if (!last) return false;
  const long = last.wordCount > 15 || (last.content?.length ?? 0) > 80;
  const emotional = last.adjustedSignals.emotional > 0 || last.adjustedSignals.harsh > 0 || last.adjustedSignals.tension > 0;
  return long && emotional;
};

export const nextRepairOrWarmth = (ctx: ContextWindow): boolean => {
  for (const n of ctx.next) {
    if (n.signals.apology > 0) return true;
    if (n.adjustedSignals.love > 0) return true;
    if (/barış|telafi|düzelt|haklısın/i.test(n.content || '')) return true;
  }
  return false;
};
