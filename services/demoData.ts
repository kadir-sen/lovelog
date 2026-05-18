// Demo mode — pre-baked AnalysisResult so users can experience the dashboard
// before they have a WhatsApp export ready. Participant names are anonymized
// ("Ali" / "Burcu"). Generated via tools/marketing-screenshots/generate-demo-data.ts.
//
// To regenerate after the analysis pipeline changes:
//   cd tools/marketing-screenshots && npx tsx generate-demo-data.ts

import type { AnalysisResult } from '../types';
import demoJson from './demoData.json';

/**
 * Date strings in the JSON need to be revived into Date objects, mirroring
 * the logic in services/persistence.ts. Kept inline here to avoid a circular
 * import and to make the demo module self-contained.
 */
const reviveDates = (raw: any): AnalysisResult => {
  if (raw?.dateRange) {
    if (typeof raw.dateRange.start === 'string')
      raw.dateRange.start = new Date(raw.dateRange.start);
    if (typeof raw.dateRange.end === 'string')
      raw.dateRange.end = new Date(raw.dateRange.end);
  }
  if (Array.isArray(raw?.normalizedMessages)) {
    for (const msg of raw.normalizedMessages) {
      if (typeof msg.date === 'string') msg.date = new Date(msg.date);
    }
  }
  if (Array.isArray(raw?.messages)) {
    for (const msg of raw.messages) {
      if (typeof msg.date === 'string') msg.date = new Date(msg.date);
    }
  }
  if (Array.isArray(raw?.rawMessages)) {
    for (const msg of raw.rawMessages) {
      if (typeof msg.date === 'string') msg.date = new Date(msg.date);
    }
  }
  if (Array.isArray(raw?.episodes)) {
    for (const ep of raw.episodes) {
      if (ep?.dateRange?.start && typeof ep.dateRange.start === 'string')
        ep.dateRange.start = new Date(ep.dateRange.start);
      if (ep?.dateRange?.end && typeof ep.dateRange.end === 'string')
        ep.dateRange.end = new Date(ep.dateRange.end);
    }
  }
  return raw as AnalysisResult;
};

/**
 * Return a fresh deep copy of the demo analysis so the caller can mutate
 * it without leaking changes across renders.
 */
export const getDemoAnalysisResult = (): AnalysisResult => {
  // JSON is import-cached; we clone to be safe against accidental mutation.
  const cloned = JSON.parse(JSON.stringify(demoJson));
  return reviveDates(cloned);
};

/**
 * Suggested viewer name for the demo. The HomeScreen / Dashboard greetings
 * use this for personalization without leaking anything from the real user.
 */
export const DEMO_VIEWER_NAME = 'Ali';

/**
 * Demo always assumes 'lover' mode — friend mode would require a separate
 * sample chat with different signal distribution.
 */
export const DEMO_RELATION_MODE = 'lover' as const;
