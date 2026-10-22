import { useCallback, useMemo } from "react";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { displayCourseName } from "@/lib/course-display";
import { suggestedPlanTime } from "@/lib/calendar-events";
import { defaultEstimateMinutes } from "@/lib/get-it-done";

export const CALENDAR_PICKS_KEY = "calendar-picks";

export interface CalendarPick {
  assignmentId: number;
  title: string;
  context: string;
  /** ISO time the entry shows on the Calendar page (a suggested time, see suggestedPlanTime). */
  at: string;
  dueAt: string | null;
}

function readList(v: unknown): CalendarPick[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (p): p is CalendarPick =>
      !!p && typeof p === "object" && typeof (p as CalendarPick).assignmentId === "number" &&
      typeof (p as CalendarPick).at === "string",
  );
}

export function useCalendarPicks() {
  const { value, set, isLoading } = useUserPreferenceKey<CalendarPick[]>(CALENDAR_PICKS_KEY, []);
  const list = useMemo(() => readList(value), [value]);
  const ids = useMemo(() => new Set(list.map((p) => p.assignmentId)), [list]);

  const add = useCallback(
    /** Puts work on the calendar at `at`, or at a sensible time before it's due. Returns the time. */
    (a: AssignmentItem, at?: string): string => {
      const when = at ?? suggestedPlanTime(a.due_at, defaultEstimateMinutes(a));
      if (ids.has(a.id)) return when;
      set([
        ...list,
        {
          assignmentId: a.id,
          title: a.name,
          context: displayCourseName(a.course_name, a.course_code),
          at: when,
          dueAt: a.due_at,
        },
      ]);
      return when;
    },
    [ids, list, set],
  );
  const remove = useCallback(
    (id: number) => set(list.filter((p) => p.assignmentId !== id)),
    [list, set],
  );
  const setTime = useCallback(
    (id: number, at: string) =>
      set(list.map((p) => (p.assignmentId === id ? { ...p, at } : p))),
    [list, set],
  );
  /** Puts a removed entry back (Undo). */
  const restore = useCallback(
    (pick: CalendarPick) => set([...list.filter((p) => p.assignmentId !== pick.assignmentId), pick]),
    [list, set],
  );
  return { list, ids, add, remove, restore, setTime, isLoading };
}
