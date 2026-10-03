// The background check (cron, every 15 minutes) writes a timestamp into the
// account's preferences each time it looks at that account. The app reads it
// to know whether closed-app alerts are actually running.

export const PUSH_HEARTBEAT_PREF = "push_last_check";

/** Two missed 15-minute runs plus slack before the check counts as stopped. */
export const HEARTBEAT_FRESH_MS = 40 * 60_000;

/** Preferences older than this (e.g. restored from the offline cache) are not trusted. */
export const PREFERENCES_FRESH_MS = 5 * 60_000;

/** When the server last checked this account, or null if it never has. */
export function lastServerCheck(preferences: Record<string, unknown> | undefined): number | null {
  const value = preferences?.[PUSH_HEARTBEAT_PREF];
  const raw =
    value && typeof value === "object" ? (value as { checkedAt?: unknown }).checkedAt : undefined;
  const at = typeof raw === "string" ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(at) ? at : null;
}

export function serverIsChecking(
  preferences: Record<string, unknown> | undefined,
  now: number,
): boolean {
  const at = lastServerCheck(preferences);
  return at != null && now - at <= HEARTBEAT_FRESH_MS;
}

/**
 * Should the open page show its own pop-ups? Not on a device that already gets
 * closed-app pushes: those alerts already arrived, and repeating them when the
 * app opens is what made everything show up at once. The page only steps in
 * when freshly loaded data shows the server has stopped checking.
 */
export function pageShouldPopUp(input: {
  deviceHasBackgroundPush: boolean;
  preferences: Record<string, unknown> | undefined;
  preferencesUpdatedAt: number;
  now: number;
}): boolean {
  if (!input.deviceHasBackgroundPush) return true;
  const fresh = input.now - input.preferencesUpdatedAt <= PREFERENCES_FRESH_MS;
  return fresh && !serverIsChecking(input.preferences, input.now);
}
