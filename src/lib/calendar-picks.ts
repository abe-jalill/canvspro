import { useCallback, useMemo } from "react";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { displayCourseName } from "@/lib/course-display";

export const CALENDAR_PICKS_KEY = "calendar-picks";

export interface CalendarPick {
  assignmentId: number;
  title: string;
  context: string;
  /** ISO time the entry shows on the Calendar page (defaults to 12:00 PM on the due day). */
  at: string;
  dueAt: string | null;
}

/** 12:00 PM local time on the assignment's due day (today if no due date). */
export function defaultNoon(dueAt: string | null): string {
  const d = dueAt ? new Date(dueAt) : new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
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
    (a: AssignmentItem) => {
      if (ids.has(a.id)) return;
      set([
        ...list,
        {
          assignmentId: a.id,
          title: a.name,
          context: displayCourseName(a.course_name, a.course_code),
          at: defaultNoon(a.due_at),
          dueAt: a.due_at,
        },
      ]);
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
  return { list, ids, add, remove, setTime, isLoading };
}
