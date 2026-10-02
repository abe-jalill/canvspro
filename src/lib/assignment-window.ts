import type { AssignmentItem } from "@/lib/canvas.functions";

const DAY_MS = 24 * 60 * 60 * 1000;

/** End of the student's local calendar day, including late-night deadlines. */
export function endOfUpcomingDay(now: number, days: number): number {
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

/** End of the local calendar day one month from `now` (Jan 31 -> Feb 28/29). */
export function endOfUpcomingMonth(now: number): number {
  const end = new Date(now);
  const day = end.getDate();
  end.setDate(1);
  end.setMonth(end.getMonth() + 1);
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  end.setDate(Math.min(day, lastDay));
  end.setHours(23, 59, 59, 999);
  return end.getTime();
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
 * Assignments whose due date passed a full day or more ago are treated as gone:
 * they are no longer actionable, so the app stops listing them.
 */
export function isStaleOverdue(a: AssignmentItem, now = Date.now()): boolean {
  if (!a.due_at) return false;
  const due = new Date(a.due_at).getTime();
  if (Number.isNaN(due)) return false;
  return due < now - DAY_MS;
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
 * visible by explicit request; unfinished work disappears after 24h overdue.
 * Undated, zero-point placeholders only appear when everything is requested.
 */
export function isAssignmentVisible(
  a: AssignmentItem,
  manuallyCompleted: boolean,
  showCompleted = false,
  now = Date.now(),
): boolean {
  const complete = isAssignmentComplete(a, manuallyCompleted);
  if (complete) return showCompleted;
  if (isPlaceholderAssignment(a)) return showCompleted;
  return !isStaleOverdue(a, now);
}

export function dropStaleOverdue(
  items: AssignmentItem[],
  now = Date.now(),
): AssignmentItem[] {
  return items.filter((a) => !isStaleOverdue(a, now));
}
