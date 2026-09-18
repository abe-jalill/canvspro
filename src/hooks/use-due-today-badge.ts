import { useEffect } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getAllAssignmentsFn } from "@/lib/canvas.functions";
import { COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { scopedKey } from "@/lib/user-scope";
import { useNotificationPrefs } from "@/lib/notification-prefs";
import { clearAppBadge, setAppBadge } from "@/lib/app-badge";

const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
  staleTime: 5 * 60_000,
});

function completedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(scopedKey(COMPLETED_ASSIGNMENTS_KEY));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Keeps the app-icon badge in sync with what's still due before midnight. */
export function useDueTodayBadge(enabled = true) {
  const { prefs } = useNotificationPrefs();
  const on = enabled && prefs.enabled && prefs.badge;
  const { data } = useQuery({ ...assignmentsQO, enabled: on });

  useEffect(() => {
    if (!on) {
      clearAppBadge();
      return;
    }
    if (!data) return;
    const done = completedIds();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const now = Date.now();
    const count = data.filter((a) => {
      if (!a.due_at || a.submission?.submitted_at) return false;
      if (done.has(String(a.id))) return false;
      const due = new Date(a.due_at).getTime();
      return due > now && due <= endOfDay.getTime();
    }).length;
    setAppBadge(count);
  }, [data, on]);
}
