import { useCallback, useEffect, useState } from "react";
import { scopedKey, subscribeToUserScope } from "@/lib/user-scope";


export interface NotificationPrefs {
  enabled: boolean;
  due1w: boolean;
  due3d: boolean;
  due2d: boolean;
  due1d: boolean;
  grades: boolean;
  announcements: boolean;
  /** Only notify about grades at or above this percentage. */
  gradeThreshold: number;
  /** Mute browser pop-ups (in-app bell still collects everything). */
  browserPush: boolean;
  /** Silence browser pop-ups during a nightly window. */
  quietEnabled: boolean;
  quietStart: number; // hour 0-23
  quietEnd: number; // hour 0-23
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  due1w: false,
  due3d: true,
  due2d: true,
  due1d: true,
  grades: true,
  announcements: true,
  gradeThreshold: 80,
  browserPush: true,
  quietEnabled: true,
  quietStart: 22,
  quietEnd: 7,
};

const BASE_KEY = "canvas:notification-prefs";
const EVENT = "canvas:notification-prefs-changed";

export function readPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(scopedKey(BASE_KEY));
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(p: NotificationPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopedKey(BASE_KEY), JSON.stringify(p));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}


export const DUE_WINDOWS: Array<{
  key: "due1w" | "due3d" | "due2d" | "due1d";
  label: string;
  hours: number;
}> = [
  { key: "due1w", label: "1 week before", hours: 24 * 7 },
  { key: "due3d", label: "3 days before", hours: 24 * 3 },
  { key: "due2d", label: "2 days before", hours: 24 * 2 },
  { key: "due1d", label: "1 day before", hours: 24 },
];

export function hourLabel(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

/** True when the current time falls inside the user's quiet window. */
export function isQuietNow(prefs: NotificationPrefs, now = new Date()): boolean {
  if (!prefs.quietEnabled) return false;
  const h = now.getHours();
  const { quietStart: s, quietEnd: e } = prefs;
  if (s === e) return false;
  return s < e ? h >= s && h < e : h >= s || h < e;
}

/** Should a browser pop-up fire right now? */
export function allowBrowserPush(prefs = readPrefs()): boolean {
  return prefs.enabled && prefs.browserPush && !isQuietNow(prefs);
}

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(readPrefs());
    const sync = () => setPrefs(readPrefs());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    const unsub = subscribeToUserScope(sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      unsub();
    };
  }, []);


  const set = useCallback(<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      writePrefs(next);
      return next;
    });
  }, []);

  const toggle = useCallback((key: keyof NotificationPrefs) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writePrefs(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    writePrefs(DEFAULT_PREFS);
  }, []);

  return { prefs, set, toggle, reset };
}
