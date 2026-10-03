import type { User } from "@supabase/supabase-js";

/**
 * Offline sign-in helpers.
 *
 * With no connection, Supabase cannot refresh an expired access token, so
 * `getSession()` reports "no session" even though the session is still stored
 * on the device. Treating that as signed out sends the person to a sign-in
 * screen they cannot use offline. These helpers let the app keep using the
 * stored session while the network is down; every API call still validates the
 * token and enforces row-level security once it is back.
 */

/** True when a failure looks like "no network" rather than "not signed in". */
export function isOfflineLike(error: unknown, online?: boolean): boolean {
  const isOnline =
    online ?? (typeof navigator === "undefined" ? true : navigator.onLine !== false);
  if (!isOnline) return true;
  const name = (error as { name?: string } | null | undefined)?.name;
  return name === "AuthRetryableFetchError";
}

type StorageLike = Pick<Storage, "length" | "key" | "getItem">;

/** The signed-in user saved by Supabase on this device, if there is one. */
export function readStoredUser(storage: StorageLike): User | null {
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      // Supabase stores the session as `sb-<project>-auth-token`.
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const parsed = JSON.parse(storage.getItem(key) ?? "null") as {
        user?: { id?: unknown };
        refresh_token?: unknown;
      } | null;
      const id = parsed?.user?.id;
      // A refresh token is what makes the session recoverable later.
      if (typeof id === "string" && id && typeof parsed?.refresh_token === "string") {
        return parsed!.user as User;
      }
    }
  } catch {
    // Unreadable storage simply means there is nothing to fall back to.
  }
  return null;
}
