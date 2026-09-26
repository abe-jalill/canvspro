import type { AssignmentItem } from "@/lib/canvas.functions";

const DAY_MS = 24 * 60 * 60 * 1000;

/** End of the student's local calendar day, including late-night deadlines. */
export function endOfUpcomingDay(now: number, days: number): number {
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

export function isAssignmentComplete(a: AssignmentItem, manuallyCompleted: boolean): boolean {
  return manuallyCompleted || Boolean(a.submission?.submitted_at) ||
    a.submission?.workflow_state === "graded" || a.submission?.score != null;
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

export function dropStaleOverdue(
  items: AssignmentItem[],
  now = Date.now(),
): AssignmentItem[] {
  return items.filter((a) => !isStaleOverdue(a, now));
}
