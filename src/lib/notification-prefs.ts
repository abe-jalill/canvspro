import { useCallback, useEffect, useState } from "react";

export interface NotificationPrefs {
  enabled: boolean;
  due1w: boolean;
  due3d: boolean;
  due2d: boolean;
  due1d: boolean;
  grades: boolean;
  announcements: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  due1w: false,
  due3d: true,
  due2d: true,
  due1d: true,
  grades: true,
  announcements: true,
};

const KEY = "canvas:notification-prefs";
const EVENT = "canvas:notification-prefs-changed";

export function readPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(p: NotificationPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
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

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(readPrefs());
    const sync = () => setPrefs(readPrefs());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
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

  return { prefs, set, toggle };
}
