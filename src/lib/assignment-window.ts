import type { AssignmentItem } from "@/lib/canvas.functions";

const DAY_MS = 24 * 60 * 60 * 1000;

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
