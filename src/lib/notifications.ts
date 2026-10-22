import { useCallback, useEffect, useState } from "react";
import { scopedKey, subscribeToUserScope } from "@/lib/user-scope";
import { allowBrowserPush } from "@/lib/notification-prefs";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";

export type NotificationKind = "due" | "overdue" | "grade" | "announcement" | "system";

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

/**
 * What's been read or removed in the bell, saved to the account so it's the
 * same on every device. Each device builds its own list from the same data,
 * with the same ids, so ids line up; "all read" and "clear" also carry a time
 * for alerts another device never listed.
 */
export const NOTIFICATIONS_STATE_KEY = "notifications-state";
const KEEP_IDS = 300;

export interface NotificationSyncState {
  readIds: string[];
  removedIds: string[];
  /** ISO time of the last "Mark all read". */
  readBefore: string | null;
  /** ISO time of the last "Clear all". */
  clearedBefore: string | null;
}

export const EMPTY_SYNC_STATE: NotificationSyncState = {
  readIds: [],
  removedIds: [],
  readBefore: null,
  clearedBefore: null,
};

export function readSyncState(value: unknown): NotificationSyncState {
  if (!value || typeof value !== "object") return EMPTY_SYNC_STATE;
  const v = value as Partial<NotificationSyncState>;
  const ids = (list: unknown) =>
    Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
  const time = (t: unknown) => (typeof t === "string" && Number.isFinite(Date.parse(t)) ? t : null);
  return {
    readIds: ids(v.readIds),
    removedIds: ids(v.removedIds),
    readBefore: time(v.readBefore),
    clearedBefore: time(v.clearedBefore),
  };
}

/** The latest state from the account, for alerts raised outside React. */
let synced: NotificationSyncState = EMPTY_SYNC_STATE;

export function isReadInSync(n: Pick<AppNotification, "id" | "ts">, state = synced): boolean {
  return (
    state.readIds.includes(n.id) ||
    (state.readBefore != null && n.ts <= Date.parse(state.readBefore))
  );
}

export function isRemovedInSync(n: Pick<AppNotification, "id" | "ts">, state = synced): boolean {
  return (
    state.removedIds.includes(n.id) ||
    (state.clearedBefore != null && n.ts <= Date.parse(state.clearedBefore))
  );
}

/** This device's list with what another device read or removed applied. */
export function applySyncState(
  list: AppNotification[],
  state: NotificationSyncState,
): AppNotification[] {
  return list
    .filter((n) => !isRemovedInSync(n, state))
    .map((n) => (!n.read && isReadInSync(n, state) ? { ...n, read: true } : n));
}

const keep = (ids: string[]) => Array.from(new Set(ids)).slice(-KEEP_IDS);

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
export function pushNotification(
  n: Omit<AppNotification, "ts" | "read"> & { ts?: number },
): boolean {
  const list = read();
  const existingIndex = list.findIndex((x) => x.id === n.id);
  if (existingIndex >= 0) {
    const existing = list[existingIndex];
    const updated = { ...existing, ...n, ts: existing.ts, read: existing.read };
    if (JSON.stringify(updated) !== JSON.stringify(existing)) {
      const next = [...list];
      next[existingIndex] = updated;
      write(next);
    }
    return false;
  }
  const created = { ...n, ts: n.ts ?? Date.now(), read: false };
  // Removed on another device: not listed again here.
  if (isRemovedInSync(created)) return false;
  // Read on another device: listed as read, with no pop-up.
  const read_ = isReadInSync(created);
  write([{ ...created, read: read_ }, ...list]);
  return !read_;
}

/** Refreshes metadata on an existing notification without creating a new alert. */
export function updateNotification(
  id: string,
  patch: Partial<
    Pick<AppNotification, "course" | "course_id" | "course_name" | "course_code" | "ts">
  >,
) {
  const list = read();
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) return;
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined && v !== null),
  );
  const next = [...list];
  next[index] = { ...next[index], ...clean };
  write(next);
}

/** Fires a browser notification when permission has been granted. */
export function fireBrowserNotification(title: string, body?: string, tag?: string, to?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const viaConstructor = () => {
    try {
      new Notification(title, { body, tag });
    } catch {
      // ignore
    }
  };
  // iPhone and Android only show notifications through the service worker;
  // the page-level constructor throws there.
  if (!("serviceWorker" in navigator)) return viaConstructor();
  void navigator.serviceWorker
    .getRegistration("/")
    .then((registration) => {
      if (!registration) return viaConstructor();
      return registration.showNotification(title, {
        body,
        tag,
        icon: "/canvaspro-icon-v2-192.png",
        data: { to: to ?? "/dashboard" },
      });
    })
    .catch(viaConstructor);
}

let pendingPopUps: Array<Pick<AppNotification, "id" | "title" | "body" | "to">> = [];

/** Shows everything queued in one pass: a single alert as itself, several as one summary. */
function flushPopUps() {
  const batch = pendingPopUps;
  pendingPopUps = [];
  if (batch.length === 0 || !allowBrowserPush()) return;
  if (batch.length === 1) {
    const [only] = batch;
    fireBrowserNotification(only!.title, only!.body, only!.id, only!.to);
    return;
  }
  fireBrowserNotification(
    `${batch.length} new CoursePro alerts`,
    `${batch[0]!.title} and ${batch.length - 1} more. Open the bell to see them all.`,
    "canvaspro-summary",
    "/notifications",
  );
}

/**
 * Records an alert in the bell menu and, when allowed, shows it as a pop-up.
 * `popUp: false` keeps it in the bell only (used when this device already gets
 * the same alert as a closed-app push). Pop-ups raised in the same pass are
 * combined, so opening the app never fires a stack of them at once.
 */
export function notify(
  n: Omit<AppNotification, "ts" | "read"> & { ts?: number },
  options: { popUp?: boolean } = {},
) {
  if (!pushNotification(n)) return;
  if (options.popUp === false || !allowBrowserPush()) return;
  if (pendingPopUps.length === 0) setTimeout(flushPopUps, 0);
  pendingPopUps.push({ id: n.id, title: n.title, body: n.body, to: n.to });
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
  const sync = useUserPreferenceKey<unknown>(NOTIFICATIONS_STATE_KEY, null);

  // Whatever another device read or removed, read or removed here too.
  useEffect(() => {
    if (!sync.ready) return;
    synced = readSyncState(sync.value);
    const current = read();
    const next = applySyncState(current, synced);
    if (JSON.stringify(next) !== JSON.stringify(current)) write(next);
  }, [sync.ready, sync.value]);

  const save = useCallback(
    (change: (state: NotificationSyncState) => NotificationSyncState) => {
      const next = change(readSyncState(sync.value));
      synced = next;
      sync.set({ ...next, readIds: keep(next.readIds), removedIds: keep(next.removedIds) });
    },
    [sync],
  );

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

  const markRead = useCallback(
    (id: string) => {
      const next = read().map((n) => (n.id === id ? { ...n, read: true } : n));
      write(next);
      save((state) => ({ ...state, readIds: [...state.readIds, id] }));
    },
    [save],
  );

  const markAllRead = useCallback(() => {
    const list = read();
    write(list.map((n) => ({ ...n, read: true })));
    save((state) => ({
      ...state,
      readIds: [...state.readIds, ...list.map((n) => n.id)],
      readBefore: new Date().toISOString(),
    }));
  }, [save]);

  const remove = useCallback(
    (id: string) => {
      write(read().filter((n) => n.id !== id));
      save((state) => ({ ...state, removedIds: [...state.removedIds, id] }));
    },
    [save],
  );

  const clear = useCallback(() => {
    const list = read();
    write([]);
    save((state) => ({
      ...state,
      removedIds: [...state.removedIds, ...list.map((n) => n.id)],
      clearedBefore: new Date().toISOString(),
    }));
  }, [save]);

  return {
    notifications: list,
    unread: list.filter((n) => !n.read).length,
    markRead,
    markAllRead,
    remove,
    clear,
  };
}
