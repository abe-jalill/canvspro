import { useCallback, useEffect, useState } from "react";
import { scopedKey, subscribeToUserScope } from "@/lib/user-scope";
import { allowBrowserPush } from "@/lib/notification-prefs";

export type NotificationKind =
  | "due"
  | "overdue"
  | "grade"
  | "announcement"
  | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** Friendly class name used to group notifications. */
  course?: string;
  /** Raw Canvas course name/code, kept so nicknames can be applied at render time. */
  course_id?: number | null;
  course_name?: string | null;
  course_code?: string | null;
  /** In-app route this notification links to. */
  to?: string;
  ts: number;
  read: boolean;
}


const BASE_KEY = "canvas:notifications";
const EVENT = "canvas:notifications-changed";
const MAX = 60;

function storageKey() {
  return scopedKey(BASE_KEY);
}

function read(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return [];
    const arr = JSON.parse(raw) as AppNotification[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: AppNotification[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}


/** Adds a notification if its id has not been seen before. Returns true when added. */
export function pushNotification(n: Omit<AppNotification, "ts" | "read"> & { ts?: number }): boolean {
  const list = read();
  if (list.some((x) => x.id === n.id)) return false;
  write([{ ...n, ts: n.ts ?? Date.now(), read: false }, ...list]);
  return true;
}

/** Fires a browser notification when permission has been granted. */
export function fireBrowserNotification(title: string, body?: string, tag?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag });
  } catch {
    // ignore
  }
}

export function notify(n: Omit<AppNotification, "ts" | "read">) {
  // Always record in the bell menu; only interrupt when the user allows it.
  if (pushNotification(n) && allowBrowserPush()) {
    fireBrowserNotification(n.title, n.body, n.id);
  }
}

/** Unread first, then newest first. */
function sortNotifications(list: AppNotification[]): AppNotification[] {
  return [...list].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return b.ts - a.ts;
  });
}

export function useNotifications() {
  const [list, setList] = useState<AppNotification[]>([]);

  useEffect(() => {
    setList(sortNotifications(read()));
    const sync = () => setList(sortNotifications(read()));
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    const unsub = subscribeToUserScope(sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      unsub();
    };
  }, []);


  const markRead = useCallback((id: string) => {
    const next = read().map((n) => (n.id === id ? { ...n, read: true } : n));
    write(next);
  }, []);

  const markAllRead = useCallback(() => {
    write(read().map((n) => ({ ...n, read: true })));
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((n) => n.id !== id));
  }, []);

  const clear = useCallback(() => write([]), []);

  return {
    notifications: list,
    unread: list.filter((n) => !n.read).length,
    markRead,
    markAllRead,
    remove,
    clear,
  };
}
