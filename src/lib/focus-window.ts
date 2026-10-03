import type { AssignmentItem } from "./canvas.functions.ts";
import { endOfAheadWindow, endOfUpcomingDay, isAssignmentVisible } from "./assignment-window.ts";

export type FocusWindow = "all" | "7" | "overdue" | "3" | "2" | "1";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isFocusWindow(value: unknown): value is FocusWindow {
  return value === "all" || value === "7" || value === "overdue" || value === "3" || value === "2" || value === "1";
}

/**
 * Reads the `?window=` value. The URL parser hands back `3` as a number, so it
 * is turned back into text first; anything unrecognised means one week.
 */
export function normalizeFocusWindow(value: unknown): FocusWindow {
  const text = typeof value === "number" ? String(value) : value;
  return isFocusWindow(text) ? text : "7";
}

/** Date selection is independent of completion, skips, and planner settings. */
export function isDueInFocusWindow(assignment: AssignmentItem, window: FocusWindow, now: number): boolean {
  const due = assignment.due_at ? Date.parse(assignment.due_at) : NaN;
  // "All" means everything inside the shared window: nothing beyond four weeks out.
  if (window === "all") return !Number.isFinite(due) || due <= endOfAheadWindow(now);
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
  if (!isAssignmentVisible(assignment, completed, false, now)) return false;
  return isDueInFocusWindow(assignment, window, now);
}
