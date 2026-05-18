// Wrapped — mini scroll story from an AnalysisResult.
//
// Why this lives in its own service:
//   • Wrapped is a different read-shape than Dashboard. Dashboard renders
//     metrics + charts; Wrapped renders a sequence of one-fact slides.
//     Computing them upfront keeps WrappedScreen.tsx purely presentational.
//   • All slides are derived from the same AnalysisResult the user already
//     has — no extra network calls, no server analyze.
//   • Slides degrade gracefully: if the analysis lacks a field (e.g. no
//     episodes), buildWrappedSlides simply skips that slide.

import type { AnalysisResult, RelationshipEpisode } from '../types';

export type WrappedSlide =
  | { kind: 'intro'; year: number; coupleNames: [string, string]; messageCount: number }
  | { kind: 'total'; messageCount: number; daysSpan: number; dailyAvg: number }
  | { kind: 'top-month'; monthLabel: string; messageCount: number }
  | { kind: 'top-emoji'; emoji: string; count: number }
  | { kind: 'top-ritual'; ritualName: string; nightCount: number; morningCount: number }
  | { kind: 'longest-silence'; days: number; from: Date; to: Date }
  | { kind: 'repair-balance'; aRepairs: number; bRepairs: number; aName: string; bName: string }
  | { kind: 'love-words'; words: { word: string; count: number }[] }
  | { kind: 'closing'; coupleNames: [string, string]; year: number; messageCount: number };

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const RITUAL_NAMES_TR: Record<string, string> = {
  good_night: 'İyi geceler ritüeli',
  good_morning: 'Günaydın ritüeli',
  miss_you: '"Seni özledim" ritüeli',
  love_you: '"Seni seviyorum" ritüeli',
  thinking_of_you: 'Hatırlama ritüeli',
};

/**
 * Format a "March 2025"-style label from a period key like "2025-03".
 * Falls back to the raw key if parsing fails.
 */
const formatMonthKey = (key: string): string => {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  const year = m[1];
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return key;
  return `${MONTH_NAMES_TR[monthIdx]} ${year}`;
};

/**
 * Format a ritual key into a human-friendly Turkish label.
 */
const formatRitualName = (key: string): string =>
  RITUAL_NAMES_TR[key] ?? key.replace(/_/g, ' ');

/**
 * Find the period (month or week) with the highest messageCount.
 * Prefers monthly granularity if periodSummaries contains both.
 */
const findTopMonth = (
  periods: AnalysisResult['periodSummaries'],
): { key: string; count: number } | null => {
  if (!periods?.length) return null;
  // Keys may be "2025-03" (month) or "2025-W12" (week). We pick monthly.
  const monthly = periods.filter((p) => /^\d{4}-\d{2}$/.test(p.key));
  const pool = monthly.length > 0 ? monthly : periods;
  let best = pool[0];
  for (const p of pool) {
    if (p.messageCount > best.messageCount) best = p;
  }
  return { key: best.key, count: best.messageCount };
};

/**
 * Sum ritualTimeDistribution across all ritual kinds and pick the one
 * with the highest total. Returns night/morning split for narrative.
 */
const findTopRitual = (
  ritualDist: NonNullable<NonNullable<AnalysisResult['styleProfile']>['relationshipDialect']>['ritualTimeDistribution'],
): { key: string; night: number; morning: number; total: number } | null => {
  if (!ritualDist) return null;
  let best: { key: string; night: number; morning: number; total: number } | null = null;
  for (const [key, counts] of Object.entries(ritualDist)) {
    const total = counts.total ?? counts.night + counts.morning + counts.day;
    if (total < 3) continue; // skip noise — Wrapped should feel earned
    if (!best || total > best.total) {
      best = { key, night: counts.night, morning: counts.morning, total };
    }
  }
  return best;
};

/**
 * Pick the longest ghosting_gap episode. Returns the day count and range.
 */
const findLongestSilence = (
  episodes: RelationshipEpisode[] | undefined,
): { days: number; from: Date; to: Date } | null => {
  if (!episodes?.length) return null;
  const gaps = episodes.filter((e) => e.type === 'ghosting_gap');
  if (!gaps.length) return null;
  let best = gaps[0];
  let bestDays = 0;
  for (const g of gaps) {
    const from = new Date(g.startTime);
    const to = new Date(g.endTime);
    const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / (24 * 3600 * 1000)));
    if (days > bestDays) {
      best = g;
      bestDays = days;
    }
  }
  if (bestDays < 1) return null;
  return {
    days: bestDays,
    from: new Date(best.startTime),
    to: new Date(best.endTime),
  };
};

/**
 * Count repair episodes attributed to each participant. Defaults to even
 * split if speaker isn't tracked.
 */
const countRepairs = (
  episodes: RelationshipEpisode[] | undefined,
  participants: AnalysisResult['participants'],
): { aRepairs: number; bRepairs: number; aName: string; bName: string } | null => {
  const aName = participants[0]?.name ?? 'A';
  const bName = participants[1]?.name ?? 'B';
  if (!episodes?.length) return null;
  const repairs = episodes.filter((e) => e.type === 'repair');
  if (repairs.length < 2) return null;
  let aRepairs = 0;
  let bRepairs = 0;
  for (const r of repairs) {
    const initiator = (r as any).initiator ?? (r as any).speaker ?? null;
    if (initiator === aName) aRepairs++;
    else if (initiator === bName) bRepairs++;
  }
  if (aRepairs === 0 && bRepairs === 0) return null;
  return { aRepairs, bRepairs, aName, bName };
};

/**
 * Build the ordered slide list for the given analysis. Some slides are
 * skipped when their underlying data is too thin (e.g. no episodes).
 *
 * `year` lets the caller scope the wrapped to a calendar year; pass
 * `undefined` to use the full analysis range.
 */
export const buildWrappedSlides = (
  analysis: AnalysisResult,
  year?: number,
): WrappedSlide[] => {
  const slides: WrappedSlide[] = [];

  const start = analysis.dateRange.start instanceof Date
    ? analysis.dateRange.start
    : new Date(analysis.dateRange.start);
  const end = analysis.dateRange.end instanceof Date
    ? analysis.dateRange.end
    : new Date(analysis.dateRange.end);
  const daysSpan = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)));
  const dailyAvg = analysis.totalMessages / daysSpan;

  const aName = analysis.participants[0]?.name ?? 'A';
  const bName = analysis.participants[1]?.name ?? 'B';
  const displayYear = year ?? end.getFullYear();

  // 1. Intro — couple + year
  slides.push({
    kind: 'intro',
    year: displayYear,
    coupleNames: [aName, bName],
    messageCount: analysis.totalMessages,
  });

  // 2. Total volume
  slides.push({
    kind: 'total',
    messageCount: analysis.totalMessages,
    daysSpan,
    dailyAvg: Math.round(dailyAvg),
  });

  // 3. Top month (highest message volume)
  const topMonth = findTopMonth(analysis.periodSummaries);
  if (topMonth) {
    slides.push({
      kind: 'top-month',
      monthLabel: formatMonthKey(topMonth.key),
      messageCount: topMonth.count,
    });
  }

  // 4. Top emoji
  if (analysis.emojiAnalysis?.length) {
    const topEmoji = analysis.emojiAnalysis[0];
    if (topEmoji && (topEmoji as any).emoji) {
      slides.push({
        kind: 'top-emoji',
        emoji: (topEmoji as any).emoji,
        count: (topEmoji as any).count ?? 0,
      });
    }
  }

  // 5. Top ritual (night/morning streak)
  const ritual = findTopRitual(
    analysis.styleProfile?.relationshipDialect?.ritualTimeDistribution,
  );
  if (ritual) {
    slides.push({
      kind: 'top-ritual',
      ritualName: formatRitualName(ritual.key),
      nightCount: ritual.night,
      morningCount: ritual.morning,
    });
  }

  // 6. Longest silence
  const silence = findLongestSilence(analysis.episodes);
  if (silence) {
    slides.push({
      kind: 'longest-silence',
      days: silence.days,
      from: silence.from,
      to: silence.to,
    });
  }

  // 7. Repair balance
  const repairs = countRepairs(analysis.episodes, analysis.participants);
  if (repairs) {
    slides.push({
      kind: 'repair-balance',
      ...repairs,
    });
  }

  // 8. Love-word vocabulary
  if (analysis.loveWordStats?.length) {
    const words = analysis.loveWordStats
      .slice(0, 5)
      .map((w: any) => ({
        word: w.word ?? w.token ?? '?',
        count: w.count ?? w.totalCount ?? 0,
      }))
      .filter((w) => w.word !== '?' && w.count > 0);
    if (words.length >= 2) {
      slides.push({ kind: 'love-words', words });
    }
  }

  // 9. Closing — share-CTA anchor
  slides.push({
    kind: 'closing',
    coupleNames: [aName, bName],
    year: displayYear,
    messageCount: analysis.totalMessages,
  });

  return slides;
};
