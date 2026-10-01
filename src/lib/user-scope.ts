// Per-account namespacing for browser storage.
//
// Everything we keep in localStorage (dismissed announcements, completed
// assignments, notification history/preferences, grade snapshots, reminders)
// is personal data. Without a per-user prefix, a second account signing in on
// the same device would inherit the previous user's state. Every key therefore
// goes through `scopedKey()`.

import { useEffect, useState } from "react";

const EVENT = "canvas:user-scope-changed";

let scope: string | null = null;

/** Legacy, un-namespaced keys written before scoping existed. */
const LEGACY_KEYS = [
  "canvas:dismissed-announcements",
  "canvas:completed-assignments",
  "canvas:notifications",
  "canvas:notification-prefs",
  "canvas:seen-graded",
  "canvas:seen-announcements",
  "canvas:last-seen-grades",
  "canvas:last-visit",
  "canvas:last-countdown",
  "reminders.enabled",
  "reminders.lastHour",
];

function purgeLegacyKeys() {
  if (typeof window === "undefined") return;
  for (const k of LEGACY_KEYS) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      // ignore
    }
  }
}

export function getUserScope(): string | null {
  return scope;
}

/**
 * Local notification preference cache (also synced with the account) and UI
 * chrome survive sign-out on this device, still isolated by account scope.
 */
const DEVICE_LOCAL_BASES = ["notification-prefs", "sidebar-mode"];

/**
 * Removes cached account data belonging to one account — the persisted query
 * cache and profile copy above all — so nothing can be served to, or reused
 * by, the next account signing in on this device.
 */
export function purgeScopedStorage(userId: string | null = scope): void {
  if (typeof window === "undefined") return;
  const prefix = `cp:${userId ?? "anon"}:`;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const base = k.slice(prefix.length);
      if (DEVICE_LOCAL_BASES.includes(base)) continue;
      keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

/**
 * Account deletion: remove every trace of the account on this device,
 * including the normally device-local preferences, so nothing can be reused.
 */
export function purgeAllScopedStorage(userId: string | null = scope): void {
  if (typeof window === "undefined") return;
  const prefix = `cp:${userId ?? "anon"}:`;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export function setUserScope(userId: string | null) {
  if (scope === userId) return;
  scope = userId;
  purgeLegacyKeys();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

/** Prefixes a storage key with the signed-in user's id. */
export function scopedKey(base: string): string {
  return `cp:${scope ?? "anon"}:${base}`;
}

/** Re-renders when the signed-in account changes. */
export function useUserScope(): string | null {
  const [current, setCurrent] = useState<string | null>(scope);
  useEffect(() => {
    setCurrent(scope);
    const sync = () => setCurrent(scope);
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return current;
}

/** Scoped storage key that updates when the signed-in account changes. */
export function useScopedKey(base: string): string {
  useUserScope();
  return scopedKey(base);
}

export function subscribeToUserScope(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
