import type { AssignmentItem } from "./canvas.functions.ts";

export type FocusWindow = "7" | "overdue" | "3" | "2" | "1";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isFocusWindow(value: unknown): value is FocusWindow {
  return value === "7" || value === "overdue" || value === "3" || value === "2" || value === "1";
}

/** One definition for dashboard counts and the corresponding Focus lists. */
export function isInFocusWindow(
  assignment: AssignmentItem,
  window: FocusWindow,
  now: number,
  completed: boolean,
): boolean {
  if (
    completed ||
    assignment.submission?.submitted_at ||
    assignment.submission?.workflow_state === "graded"
  )
    return false;
  const due = assignment.due_at ? Date.parse(assignment.due_at) : NaN;
  if (!Number.isFinite(due)) return false;
  if (window === "overdue") return due < now;
  return due >= now && due <= now + Number(window) * DAY_MS;
}
