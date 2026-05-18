// Telemetry — minimal, privacy-respecting event tracking.
//
// Why: marketing needs funnel + retention metrics, but raw chat content
// must NEVER appear in any event. Events flow through three sinks:
//   1. console (dev visibility)
//   2. attribution SDK (Adjust — wired in Phase 2; no-op stub until then)
//   3. apiClient → POST /api/events (server sink — wired in Phase 3)
//
// Consent: default opt-in (saved at 'lovelog.telemetryConsent.v1').
// If the user revokes, no event leaves the device.

export type TelemetryEvent =
  // Lifecycle
  | 'app_open'
  | 'first_open'
  // Upload funnel
  | 'upload_started'
  | 'upload_completed'
  | 'relation_selected'
  | 'participant_selected'
  | 'analysis_viewed'
  | 'dashboard_card_tapped'
  // Sharing
  | 'share_initiated'
  | 'share_completed'
  | 'share_failed'
  // Demo
  | 'demo_started'
  | 'demo_to_real_clicked'
  // Wrapped
  | 'wrapped_opened'
  | 'wrapped_slide_viewed'
  | 'wrapped_shared'
  // Quiz
  | 'quiz_started'
  | 'quiz_completed'
  // Invite
  | 'invite_generated'
  | 'invite_link_copied'
  | 'invite_viewed_by_partner';

const CONSENT_KEY = 'lovelog.telemetryConsent.v1';

/** Read consent flag. Default: true (opt-in by default; user can revoke). */
const hasConsent = (): boolean => {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
};

export const setTelemetryConsent = (consent: boolean): void => {
  try {
    localStorage.setItem(CONSENT_KEY, consent ? '1' : '0');
  } catch {
    /* ignore */
  }
};

export const getTelemetryConsent = (): boolean => hasConsent();

const isDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local'));

/**
 * Forward to Adjust if available. Resolves silently if SDK absent or web.
 * Static import is fine because services/attribution.ts ships as a stub
 * until Phase 2; the real Adjust SDK call only fires on Capacitor anyway.
 */
import { trackEvent as attributionTrackEvent } from './attribution';

const forwardToAttribution = (
  name: TelemetryEvent,
  props?: Record<string, unknown>,
): void => {
  try {
    attributionTrackEvent(name, props);
  } catch {
    /* attribution stub should never throw, but stay defensive */
  }
};

/**
 * Forward to server sink if reachable. Best-effort; never blocks UI.
 * Uses navigator.sendBeacon when available to survive page unloads.
 */
const forwardToServer = async (
  name: TelemetryEvent,
  props?: Record<string, unknown>,
): Promise<void> => {
  try {
    const baseUrl = ((import.meta as any).env?.VITE_API_BASE_URL ?? '/api')
      .toString()
      .replace(/\/+$/, '');
    const body = JSON.stringify({ name, props });
    const deviceId = localStorage.getItem('lovelog.deviceId') ?? '';
    if (!deviceId) return;
    // sendBeacon for fire-and-forget; fall back to fetch keepalive
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        // Note: sendBeacon can't set custom headers. We pass the device id
        // via a URL query param when using the beacon path. Server accepts both.
        navigator.sendBeacon(
          `${baseUrl}/events?did=${encodeURIComponent(deviceId)}`,
          blob,
        );
        return;
      } catch {
        /* fall through */
      }
    }
    await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId,
      },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never let telemetry break the app */
  }
};

/**
 * Track an event. Fire-and-forget.
 * - Skips entirely if user revoked consent
 * - Filters out any prop that looks like raw message content
 *   (string longer than 200 chars OR contains newline)
 */
export const track = (
  name: TelemetryEvent,
  props?: Record<string, unknown>,
): void => {
  if (!hasConsent()) return;

  const safe = props ? sanitizeProps(props) : undefined;

  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(`[telemetry] ${name}`, safe ?? '');
  }

  // Both sinks are fire-and-forget; never await.
  forwardToAttribution(name, safe);
  void forwardToServer(name, safe);
};

/**
 * Strip anything that smells like raw chat content. Marketing telemetry
 * MUST NOT carry message bodies — privacy contract is absolute.
 */
const sanitizeProps = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') {
      if (value.length > 200 || /\n/.test(value)) continue;
      out[key] = value;
    } else if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.length; // collapse arrays to length
    } else if (typeof value === 'object') {
      out[key] = '[object]';
    }
  }
  return out;
};

/**
 * Mark whether this is the user's first app open. Used to fire `first_open`
 * exactly once, plus `app_open` on every boot.
 */
const FIRST_OPEN_KEY = 'lovelog.firstOpenAt.v1';

export const trackBoot = (): void => {
  let isFirst = false;
  try {
    if (!localStorage.getItem(FIRST_OPEN_KEY)) {
      localStorage.setItem(FIRST_OPEN_KEY, String(Date.now()));
      isFirst = true;
    }
  } catch {
    /* ignore */
  }
  if (isFirst) track('first_open');
  track('app_open');
};
