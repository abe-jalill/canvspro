import type { AssignmentItem } from "./canvas.functions.ts";
import { endOfUpcomingDay, isAssignmentComplete } from "./assignment-window.ts";

export type FocusWindow = "all" | "7" | "overdue" | "3" | "2" | "1";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isFocusWindow(value: unknown): value is FocusWindow {
  return value === "all" || value === "7" || value === "overdue" || value === "3" || value === "2" || value === "1";
}

/** Date selection is independent of completion, skips, and planner settings. */
export function isDueInFocusWindow(assignment: AssignmentItem, window: FocusWindow, now: number): boolean {
  if (window === "all") return true;
  const due = assignment.due_at ? Date.parse(assignment.due_at) : NaN;
  if (!Number.isFinite(due)) return false;
  if (window === "overdue") return due < now;
  const end = window === "7" ? endOfUpcomingDay(now, 7) : now + Number(window) * DAY_MS;
  return due >= now && due <= end;
}

/** One definition for dashboard counts and the corresponding Focus lists. */
export function isInFocusWindow(
  assignment: AssignmentItem,
  window: FocusWindow,
  now: number,
  completed: boolean,
): boolean {
  if (isAssignmentComplete(assignment, completed)) return false;
  return isDueInFocusWindow(assignment, window, now);
}
