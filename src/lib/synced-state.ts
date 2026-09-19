import { useCallback, useMemo } from "react";
import {
  useUserPreferenceKey,
  useSetUserPreference,
} from "@/hooks/use-user-preferences";

export const DISMISSED_ANNOUNCEMENTS_KEY = "dismissed-announcements";
export const COMPLETED_ASSIGNMENTS_KEY = "completed-assignments";

function readSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((v): v is string => typeof v === "string"));
}

/**
 * Cross-device persisted Set<string> backed by `user_preferences`.
 *
 * Writes are refused until this account's stored value has actually been read
 * from the database — otherwise a write made during loading would persist the
 * empty default and wipe everything saved on another device.
 */
export function useSyncedSet(baseKey: string) {
  const { value, isLoading, ready, set } = useUserPreferenceKey<string[]>(
    baseKey,
    [],
  );

  const setMemo = useMemo(() => readSet(value), [value]);

  const setValue = useCallback(
    (next: Set<string>) => {
      if (!ready) return;
      set(Array.from(next));
    },
    [ready, set],
  );

  const has = useCallback(
    (id: string | number) => setMemo.has(String(id)),
    [setMemo],
  );

  const add = useCallback(
    (id: string | number) => {
      const next = new Set(setMemo);
      next.add(String(id));
      setValue(next);
    },
    [setMemo, setValue],
  );

  const remove = useCallback(
    (id: string | number) => {
      const next = new Set(setMemo);
      next.delete(String(id));
      setValue(next);
    },
    [setMemo, setValue],
  );

  const toggle = useCallback(
    (id: string | number) => {
      const next = new Set(setMemo);
      const k = String(id);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      setValue(next);
    },
    [setMemo, setValue],
  );

  return { has, add, remove, toggle, size: setMemo.size, isLoading, ready };
}

/** Merge a localStorage-backed set into the synced preference on first sign-in. */
export function useSyncLocalStorage() {
  const set = useSetUserPreference();
  return useCallback(
    (key: string, localKey: string) => {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(localKey);
      if (!raw) return;
      try {
        const arr = JSON.parse(raw) as string[];
        const values = arr.filter((v) => typeof v === "string");
        if (values.length > 0) {
          set.mutate({ key, value: values });
          window.localStorage.removeItem(localKey);
        }
      } catch {
        // ignore
      }
    },
    [set],
  );
}

/** Re-export the legacy key names but backed by synced storage. */
export function useLocalSet(baseKey: string) {
  return useSyncedSet(baseKey);
}

export { DISMISSED_ANNOUNCEMENTS_KEY as DISMISSED_ANNOUNCEMENTS_KEY_LEGACY };
export { COMPLETED_ASSIGNMENTS_KEY as COMPLETED_ASSIGNMENTS_KEY_LEGACY };
