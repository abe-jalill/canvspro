import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { assignmentsQueryOptions } from "@/lib/canvas.queries";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { completedAssignmentIds } from "@/lib/completion-records";
import { useNotificationPrefs } from "@/lib/notification-prefs";
import { clearAppBadge, setAppBadge } from "@/lib/app-badge";

/** Keeps the app-icon badge in sync with what's still due before midnight. */
export function useDueTodayBadge(enabled = true) {
  const { prefs } = useNotificationPrefs();
  const on = enabled && prefs.enabled && prefs.badge;
  const { data } = useQuery({ ...assignmentsQueryOptions, enabled: on });
  const preferences = useUserPreferences();
  const done = useMemo(() => completedAssignmentIds(preferences.data), [preferences.data]);

  useEffect(() => {
    if (!on) {
      clearAppBadge();
      return;
    }
    if (!data) return;
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
  }, [data, on, done]);
}
