import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthUserId, userKey } from "@/lib/auth-user";
import { completedAssignmentIds, COMPLETION_PREFIX } from "@/lib/completion-records";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { canvasSaysComplete, isAssignmentComplete } from "@/lib/assignment-window";
import {
  useUserPreferenceKey,
  useSetUserPreference,
  useUserPreferences, userPreferencesQueryKey, type PrefMap,
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
  const qc = useQueryClient();
  const { userId } = useAuthUserId();
  const preferences = useUserPreferences();
  const save = useSetUserPreference();
  const { value, isLoading, ready, set } = useUserPreferenceKey<string[]>(
    baseKey,
    [],
  );

  const setMemo = useMemo(() => baseKey === COMPLETED_ASSIGNMENTS_KEY
    ? completedAssignmentIds(preferences.data) : readSet(value), [baseKey, preferences.data, value]);

  const change = useCallback((id: string | number, operation: "add" | "remove" | "toggle") => {
    if (!ready) return;
    const current = qc.getQueryData<PrefMap>(userKey(userPreferencesQueryKey, userId));
    const ids = baseKey === COMPLETED_ASSIGNMENTS_KEY ? completedAssignmentIds(current) : readSet(current?.[baseKey]);
    const k = String(id);
    if (baseKey === COMPLETED_ASSIGNMENTS_KEY) {
      const assignment = qc.getQueryData<AssignmentItem[]>(["canvas", "assignments"])?.find((a) => String(a.id) === k);
      // Toggle from what the person sees: done by their own mark OR by Canvas.
      const doneNow = assignment ? isAssignmentComplete(assignment, ids.has(k)) : ids.has(k);
      const completed = operation === "add" || (operation === "toggle" && !doneNow);
      // Marking not-done over a Canvas submission is remembered as a reopen, so
      // Canvas's status stops overriding it (until a newer submission arrives).
      const reopen = !completed && assignment != null && canvasSaysComplete(assignment);
      save.mutate({ key: `${COMPLETION_PREFIX}${k}`, value: {
        completed, completedAt: completed ? new Date().toISOString() : null,
        dueAt: assignment?.due_at ?? null,
        ...(reopen ? { reopenedAt: new Date().toISOString() } : {}),
      } });
    } else {
      const completed = operation === "add" || (operation === "toggle" && !ids.has(k));
      if (completed) ids.add(k); else ids.delete(k);
      set(Array.from(ids));
    }
  }, [ready, qc, userId, baseKey, save, set]);

  const has = useCallback(
    (id: string | number) => setMemo.has(String(id)),
    [setMemo],
  );

  return {
    has, add: (id: string | number) => change(id, "add"),
    remove: (id: string | number) => change(id, "remove"),
    toggle: (id: string | number) => change(id, "toggle"),
    size: setMemo.size, isLoading, ready,
  };
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
