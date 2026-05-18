// Attribution SDK wrapper for Adjust.
//
// Why this shape:
//   • Web: every export is a no-op. Web traffic is tracked separately via
//     Meta Pixel + TikTok Pixel + GA4 (Phase 3 server events).
//   • Mobile: when the Adjust Capacitor plugin is installed AND configured
//     with a real app token, initAttribution() boots the SDK and trackEvent()
//     forwards to Adjust. Without those, every call is a silent no-op.
//
// Why we don't hard-import the Adjust plugin:
//   • Adjust does NOT have an official Capacitor plugin in npm. The community
//     options are @joinflux/capacitor-adjust and the Cordova plugin wrapped
//     via Capacitor. Choice depends on the team's release pipeline and SKAdNetwork
//     setup. To avoid coupling this commit to either choice (and to keep the
//     web build clean), we lazy-load the plugin and treat its absence as expected.
//   • To enable Adjust at launch:
//       1. Get an Adjust app token from the Adjust dashboard
//       2. Set VITE_ADJUST_APP_TOKEN in .env and ios/android build configs
//       3. `npm install @joinflux/capacitor-adjust` (or your chosen wrapper)
//       4. `npx cap sync`
//       5. iOS: add SKAdNetwork IDs + NSUserTrackingUsageDescription to Info.plist
//       6. Android: add AD_ID permission + Install Referrer receiver
//
// Event tokens: every TelemetryEvent maps to an Adjust event token. The map
// lives in ADJUST_EVENT_TOKENS below. Tokens come from the Adjust dashboard
// after creating each event there. Until then, this is documented intent.

const isCapacitor = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean((window as any).Capacitor?.isNativePlatform?.());

const APP_TOKEN =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_ADJUST_APP_TOKEN) ||
  '';

const ADJUST_ENV: 'sandbox' | 'production' =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.PROD) === true
    ? 'production'
    : 'sandbox';

/**
 * Telemetry event → Adjust event token. Fill these in once events are
 * created in the Adjust dashboard. Unmapped events are silently skipped
 * on mobile (won't be sent to Adjust).
 */
const ADJUST_EVENT_TOKENS: Partial<Record<string, string>> = {
  // first_open: 'xxxxxx',
  // upload_completed: 'xxxxxx',
  // analysis_viewed: 'xxxxxx',
  // share_completed: 'xxxxxx',
  // quiz_completed: 'xxxxxx',
};

let pluginRef: any = null;
let initialized = false;

const loadAdjustPlugin = async (): Promise<any> => {
  if (pluginRef) return pluginRef;
  try {
    // Dynamic import via variable so Rollup doesn't fail when the plugin
    // isn't installed yet. The Capacitor runtime resolves community plugins
    // through window.Capacitor.Plugins.<Name> when bundled natively.
    const pluginName = '@joinflux/capacitor-adjust';
    const mod = await import(/* @vite-ignore */ pluginName).catch(() => null);
    pluginRef = mod;
    return mod;
  } catch {
    return null;
  }
};

/**
 * Boot the Adjust SDK on Capacitor. Idempotent. No-op on web or if no token.
 */
export const initAttribution = async (): Promise<void> => {
  if (initialized) return;
  initialized = true;
  if (!isCapacitor() || !APP_TOKEN) return;

  const plugin = await loadAdjustPlugin();
  if (!plugin?.Adjust) return;

  try {
    await plugin.Adjust.create({
      appToken: APP_TOKEN,
      environment: ADJUST_ENV,
      logLevel: ADJUST_ENV === 'sandbox' ? 'VERBOSE' : 'INFO',
      // sendInBackground: true,  // enable once SDK config is finalized
    });
  } catch (e) {
    console.warn('[attribution] Adjust init failed', e);
  }
};

/**
 * Forward a telemetry event to Adjust. Silent no-op on web, when SDK is
 * not installed, or when the event isn't mapped to an Adjust token yet.
 *
 * `props` are passed as Adjust "partner parameters" (Adjust ignores any
 * key it isn't expecting, so this is safe by default).
 */
export const trackEvent = (
  name: string,
  props?: Record<string, unknown>,
): void => {
  if (!isCapacitor() || !APP_TOKEN || !initialized) return;
  const token = ADJUST_EVENT_TOKENS[name];
  if (!token) return;

  // Fire-and-forget; plugin call is async but we never block telemetry.
  void (async () => {
    const plugin = await loadAdjustPlugin();
    if (!plugin?.AdjustEvent || !plugin?.Adjust) return;
    try {
      const event = new plugin.AdjustEvent(token);
      if (props) {
        for (const [k, v] of Object.entries(props)) {
          if (typeof v === 'string' || typeof v === 'number') {
            event.addPartnerParameter(k, String(v));
          }
        }
      }
      await plugin.Adjust.trackEvent(event);
    } catch (e) {
      console.warn('[attribution] trackEvent failed', e);
    }
  })();
};

/**
 * Get the Adjust device id (ADID). Useful for server-side cohort joins.
 * Returns null on web or when SDK isn't booted.
 */
export const getAdid = async (): Promise<string | null> => {
  if (!isCapacitor() || !APP_TOKEN || !initialized) return null;
  const plugin = await loadAdjustPlugin();
  if (!plugin?.Adjust) return null;
  try {
    const { adid } = await plugin.Adjust.getAdid();
    return adid ?? null;
  } catch {
    return null;
  }
};

/**
 * Request iOS App Tracking Transparency consent. Must be called before
 * any Adjust event with IDFA reaches the SDK. Returns whether the user
 * granted tracking permission. No-op on Android / web.
 */
export const requestTrackingConsent = async (): Promise<boolean> => {
  if (!isCapacitor()) return false;
  const plugin = await loadAdjustPlugin();
  if (!plugin?.Adjust?.requestTrackingAuthorizationWithCompletionHandler) {
    return false;
  }
  try {
    const result =
      await plugin.Adjust.requestTrackingAuthorizationWithCompletionHandler();
    // Result codes: 0 = not determined, 1 = restricted, 2 = denied, 3 = authorized
    return result?.status === 3;
  } catch {
    return false;
  }
};
