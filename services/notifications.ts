// Local notifications — weekly digest reminder, fully client-side.
//
// Why local notifications instead of server-driven push:
//   • Privacy contract: no push tokens leave the device. No FCM/APNS
//     infrastructure needed.
//   • The reminder copy never references message content; it's a static
//     "your weekly report is ready" nudge, which works without ever reading
//     the user's chats again.
//   • Scheduling is repeating native (iOS UNCalendarNotificationTrigger,
//     Android AlarmManager) so the OS handles delivery even when the app
//     is closed.
//
// Trigger: every Sunday at 21:00 local time, repeating.
// Tap behavior: opens the app; App.tsx 'app_open' tracking fires as usual.

const isCapacitor = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean((window as any).Capacitor?.isNativePlatform?.());

const WEEKLY_DIGEST_ID = 4242;

const loadPlugin = async (): Promise<any> => {
  try {
    return await import('@capacitor/local-notifications');
  } catch {
    return null;
  }
};

/**
 * Request notification permission. Required on iOS (any version) and
 * Android 13+ (POST_NOTIFICATIONS runtime permission).
 *
 * Returns true if granted. No-op on web.
 */
export const requestPermission = async (): Promise<boolean> => {
  if (!isCapacitor()) return false;
  const plugin = await loadPlugin();
  if (!plugin?.LocalNotifications) return false;
  try {
    const result = await plugin.LocalNotifications.requestPermissions();
    return result?.display === 'granted';
  } catch (e) {
    console.warn('[notifications] permission request failed', e);
    return false;
  }
};

/**
 * Schedule the weekly digest notification — Sunday 21:00 local, repeating.
 * Idempotent: replaces any prior schedule with the same ID.
 *
 * Privacy: title + body are static; no chat content is referenced.
 */
export const scheduleWeeklyDigest = async (): Promise<boolean> => {
  if (!isCapacitor()) return false;
  const plugin = await loadPlugin();
  if (!plugin?.LocalNotifications) return false;
  try {
    // Cancel any existing schedule first so we don't double-fire.
    await plugin.LocalNotifications.cancel({
      notifications: [{ id: WEEKLY_DIGEST_ID }],
    }).catch(() => {});

    await plugin.LocalNotifications.schedule({
      notifications: [
        {
          id: WEEKLY_DIGEST_ID,
          title: 'Bu hafta ilişkin nasıl gözükmüş?',
          body: 'Son raporunu yeniden açmak için dokun.',
          schedule: {
            // weekday = 1 (Sunday) per Capacitor docs (Sunday is 1, Saturday is 7)
            on: { weekday: 1, hour: 21, minute: 0 },
            repeats: true,
            allowWhileIdle: true,
          },
          // Sound + small icon use defaults; smallIcon is set on the
          // Android Manifest level by capacitor.config.ts.
        },
      ],
    });
    return true;
  } catch (e) {
    console.warn('[notifications] schedule failed', e);
    return false;
  }
};

/**
 * Cancel the weekly digest. Used when the user opts out or clears all
 * device data.
 */
export const cancelWeeklyDigest = async (): Promise<void> => {
  if (!isCapacitor()) return;
  const plugin = await loadPlugin();
  if (!plugin?.LocalNotifications) return;
  try {
    await plugin.LocalNotifications.cancel({
      notifications: [{ id: WEEKLY_DIGEST_ID }],
    });
  } catch {
    /* ignore */
  }
};

/**
 * Whether the weekly digest is currently scheduled. Used by Settings UI
 * to show the toggle state. Best-effort: queries the OS for pending
 * notifications and looks for our ID.
 */
export const isWeeklyDigestScheduled = async (): Promise<boolean> => {
  if (!isCapacitor()) return false;
  const plugin = await loadPlugin();
  if (!plugin?.LocalNotifications) return false;
  try {
    const { notifications } =
      await plugin.LocalNotifications.getPending();
    return Array.isArray(notifications)
      ? notifications.some((n: any) => n.id === WEEKLY_DIGEST_ID)
      : false;
  } catch {
    return false;
  }
};

/**
 * Listen for taps on our notifications. Caller passes a callback that
 * receives the notification id (so multi-notification routing is possible
 * later). Returns a cleanup function.
 */
export const onNotificationTap = (
  callback: (notificationId: number) => void,
): (() => void) => {
  if (!isCapacitor()) return () => {};
  let cleanup = () => {};
  void (async () => {
    const plugin = await loadPlugin();
    if (!plugin?.LocalNotifications?.addListener) return;
    const handle = await plugin.LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action: any) => {
        const id = action?.notification?.id;
        if (typeof id === 'number') callback(id);
      },
    );
    cleanup = () => {
      try {
        handle?.remove?.();
      } catch {
        /* ignore */
      }
    };
  })();
  return () => cleanup();
};
