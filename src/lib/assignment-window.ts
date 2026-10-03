import type { AssignmentItem } from "@/lib/canvas.functions";

/** The one window every list uses: a few days back, a few weeks ahead. */
export const RECENT_DAYS = 3;
export const AHEAD_DAYS = 28;

/** End of the student's local calendar day, including late-night deadlines. */
export function endOfUpcomingDay(now: number, days: number): number {
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

/** Start of the local day `RECENT_DAYS` ago: nothing due before this is listed. */
export function startOfRecentWindow(now: number): number {
  const start = new Date(now);
  start.setDate(start.getDate() - RECENT_DAYS);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

/** End of the last day shown ahead (four weeks out). */
export function endOfAheadWindow(now: number): number {
  return endOfUpcomingDay(now, AHEAD_DAYS);
}

/** Dated work inside the shared window: from 3 days ago to 4 weeks ahead. */
export function isInDisplayWindow(a: Pick<AssignmentItem, "due_at">, now = Date.now()): boolean {
  if (!a.due_at) return false;
  const due = new Date(a.due_at).getTime();
  if (Number.isNaN(due)) return false;
  return due >= startOfRecentWindow(now) && due <= endOfAheadWindow(now);
}

export function isAssignmentComplete(a: AssignmentItem, manuallyCompleted: boolean): boolean {
  if (manuallyCompleted) return true;
  const submission = a.submission;
  if (!submission) return false;
  if (submission.excused) return true;
  // Missing work can have an automatic zero. Canvas can also retain the
  // graded state after a grade is cleared; neither means the student is done.
  if (submission.missing) return false;
  if (submission.submitted_at || submission.workflow_state === "submitted" ||
      submission.workflow_state === "pending_review") return true;
  return submission.workflow_state === "graded" &&
    (submission.score != null || (submission.grade != null && submission.grade !== ""));
}

/**
 * Unfinished work that was due before the recent window (3 days ago) is treated
 * as gone: it is no longer actionable, so the app stops listing it.
 */
export function isStaleOverdue(a: AssignmentItem, now = Date.now()): boolean {
  if (!a.due_at) return false;
  const due = new Date(a.due_at).getTime();
  if (Number.isNaN(due)) return false;
  return due < startOfRecentWindow(now);
}

/**
 * Canvas placeholders such as "Mid-Term Grade Checkpoint": no due date and no
 * points. They are not real work, so action lists leave them out by default.
 */
export function isPlaceholderAssignment(a: AssignmentItem): boolean {
  return !a.due_at && !(a.points_possible && a.points_possible > 0);
}

/** Soonest due date first; undated work last; ties broken by name. */
export function compareByDueDate(
  a: Pick<AssignmentItem, "due_at" | "name">,
  b: Pick<AssignmentItem, "due_at" | "name">,
): number {
  const at = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
  const bt = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
  if (at !== bt) return at < bt ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/**
 * Shared visibility rule for every assignment surface. Completed work is only
 * visible by explicit request, and then only inside the shared window (3 days
 * back to 4 weeks ahead); unfinished work disappears once it is 3 days overdue.
 * Undated, zero-point placeholders only appear when everything is requested.
 */
export function isAssignmentVisible(
  a: AssignmentItem,
  manuallyCompleted: boolean,
  showCompleted = false,
  now = Date.now(),
): boolean {
  const complete = isAssignmentComplete(a, manuallyCompleted);
  if (complete) return showCompleted && isInDisplayWindow(a, now);
  if (isPlaceholderAssignment(a)) return showCompleted;
  return !isStaleOverdue(a, now);
}

export function dropStaleOverdue(
  items: AssignmentItem[],
  now = Date.now(),
): AssignmentItem[] {
  return items.filter((a) => !isStaleOverdue(a, now));
}
