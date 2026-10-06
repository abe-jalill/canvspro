import { createPreferenceEdits } from "@/lib/preference-edits";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scopedKey, subscribeToUserScope, getUserScope } from "@/lib/user-scope";

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
  /** Countdown alert before a class starts. */
  countdownClass: boolean;
  /** Minutes before the class start time to alert (0 = at start). */
  countdownLeads: number[];
  /** Evening summary of everything due before 11:59 PM today. */
  countdownTonight: boolean;
  /** Local hours (0-23) for the tonight's-deadline reminders. */
  countdownTonightHours: number[];
  /** Show a number badge on the app icon for things due today. */
  badge: boolean;
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
  countdownClass: false,
  countdownLeads: [15],
  countdownTonight: false,
  countdownTonightHours: [18],
  badge: false,
};

/** Lead-time choices for the "next class starts in…" countdown. */
export const COUNTDOWN_LEADS: Array<{ minutes: number; label: string }> = [
  { minutes: 60, label: "1 hour before" },
  { minutes: 30, label: "30 minutes before" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 5, label: "5 minutes before" },
  { minutes: 0, label: "When it starts" },
];

/** Reminder-time choices for tonight's 11:59 PM deadlines. */
export const TONIGHT_HOURS: Array<{ hour: number; label: string }> = [
  { hour: 15, label: "3:00 PM" },
  { hour: 18, label: "6:00 PM" },
  { hour: 21, label: "9:00 PM" },
  { hour: 23, label: "11:00 PM" },
];

export type BooleanPrefKey = {
  [K in keyof NotificationPrefs]: NotificationPrefs[K] extends boolean ? K : never;
}[keyof NotificationPrefs];

const BASE_KEY = "canvas:notification-prefs";
const EVENT = "canvas:notification-prefs-changed";

const editsByUser = new Map<string, ReturnType<typeof createPreferenceEdits>>();
export function notificationEdits(userId: string) {
  let edits = editsByUser.get(userId);
  if (!edits) {
    edits = createPreferenceEdits();
    editsByUser.set(userId, edits);
  }
  return edits;
}

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
  const [ready, setReady] = useState(false);
  const editRevision = useRef(0);

  useEffect(() => {
    let active = true;
    let requestRevision = 0;
    async function hydrate() {
      const request = ++requestRevision;
      const edits = editRevision.current;
      const scope = getUserScope();
      setReady(false);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active || request !== requestRevision) return;
      if (!session || session.user.id !== scope) return;
      const { data, error } = await supabase
        .from("notification_prefs")
        .select("prefs")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active || request !== requestRevision || error || scope !== getUserScope()) return;
      if (edits === editRevision.current) {
        const remote =
          data?.prefs && typeof data.prefs === "object" && !Array.isArray(data.prefs)
            ? data.prefs
            : {};
        writePrefs({ ...DEFAULT_PREFS, ...remote, ...notificationEdits(scope!).values() });
      }
      setReady(true);
    }
    setPrefs(readPrefs());
    void hydrate();
    const sync = () => {
      editRevision.current += 1;
      setPrefs(readPrefs());
    };
    const switchAccount = () => {
      sync();
      void hydrate();
    };
    const onFocus = () => {
      void hydrate();
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("canvaspro:refresh-account", onFocus);
    const unsub = subscribeToUserScope(switchAccount);
    return () => {
      active = false;
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("canvaspro:refresh-account", onFocus);
      unsub();
    };
  }, []);

  const set = useCallback(
    <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
      const scope = getUserScope();
      if (!ready || !scope) return;
      editRevision.current += 1;
      notificationEdits(scope).set(key, value);
      writePrefs({ ...readPrefs(), [key]: value });
    },
    [ready],
  );

  const toggle = useCallback(
    (key: BooleanPrefKey) => {
      set(key, !readPrefs()[key]);
    },
    [set],
  );

  const reset = useCallback(() => {
    const scope = getUserScope();
    if (!ready || !scope) return;
    editRevision.current += 1;
    for (const [key, value] of Object.entries(DEFAULT_PREFS))
      notificationEdits(scope).set(key, value);
    writePrefs(DEFAULT_PREFS);
  }, [ready]);

  return { prefs, set, toggle, reset, ready };
}
