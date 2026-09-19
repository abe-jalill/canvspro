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
 * Removes every browser-stored value belonging to one account. Called on sign
 * out so nothing (persisted query cache included) survives for the next user.
 */
export function purgeScopedStorage(userId: string | null = scope): void {
  if (typeof window === "undefined") return;
  const prefix = `cp:${userId ?? "anon"}:`;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
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
