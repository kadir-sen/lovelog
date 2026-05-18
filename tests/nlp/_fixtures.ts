// Sentetik NormalizedMessage fixture'ları — hiçbir gerçek WhatsApp dosyasından
// alınmamıştır. Yalnızca classifier'ları test etmek içindir.

import type { NormalizedMessage } from '../../types';

const baseSignals: NormalizedMessage['signals'] = {
  love: 0, emotional: 0, apology: 0, thanks: 0, planning: 0, future: 0,
  jealousy: 0, tension: 0, harsh: 0,
};

const baseAdjusted: NormalizedMessage['adjustedSignals'] = {
  love: 0, emotional: 0, tension: 0, harsh: 0,
};

let idCtr = 0;

export interface MkMsgOpts {
  author?: string;
  date?: Date;
  content: string;
  signals?: Partial<NormalizedMessage['signals']>;
  adjustedSignals?: Partial<NormalizedMessage['adjustedSignals']>;
  isShortReply?: boolean;
  hasQuestion?: boolean;
  hasExclamation?: boolean;
  playfulnessFlag?: boolean;
  negationFlag?: boolean;
  isMedia?: boolean;
}

const padN = (n: number) => String(n).padStart(2, '0');

export const mkMsg = (opts: MkMsgOpts): NormalizedMessage => {
  const date = opts.date ?? new Date(2025, 0, 1, 10, 0, 0);
  const content = opts.content;
  const words = content.split(/\s+/).filter(Boolean);
  const dateKey = `${date.getFullYear()}-${padN(date.getMonth() + 1)}-${padN(date.getDate())}`;
  return {
    id: idCtr++,
    date,
    author: opts.author ?? 'Ali',
    content,
    isMedia: !!opts.isMedia,
    dateKey,
    weekKey: `${date.getFullYear()}-W01`,
    monthKey: `${date.getFullYear()}-${padN(date.getMonth() + 1)}`,
    wordCount: words.length,
    charCount: content.length,
    emojiCount: 0,
    hasQuestion: opts.hasQuestion ?? content.includes('?'),
    hasExclamation: opts.hasExclamation ?? content.includes('!'),
    hasUrl: false,
    isShortReply: opts.isShortReply ?? (words.length <= 3 && content.length <= 25),
    clauses: [content],
    playfulnessFlag: !!opts.playfulnessFlag,
    negationFlag: !!opts.negationFlag,
    signals: { ...baseSignals, ...(opts.signals ?? {}) },
    adjustedSignals: { ...baseAdjusted, ...(opts.adjustedSignals ?? {}) },
  };
};

export const seq = (opts: MkMsgOpts[]): NormalizedMessage[] => {
  let t = new Date(2025, 0, 1, 10, 0, 0).getTime();
  return opts.map((o) => {
    const d = new Date(t);
    t += 60 * 1000; // 1 dakika ara
    return mkMsg({ ...o, date: o.date ?? d });
  });
};
