import type { AssignmentItem } from "./canvas.functions.ts";
import { notYetOpen } from "./assignment-availability.ts";

const DEFAULT_POINTS = 25;
const WEEK_MS = 7 * 24 * 60 * 60 * 1_000;

export function normalizedProgress(progress: number | null | undefined) {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress ?? 0));
}

export function remainingWork(assignment: Pick<AssignmentItem, "points_possible">, progress?: number | null) {
  const points = assignment.points_possible != null && assignment.points_possible > 0
    ? assignment.points_possible
    : DEFAULT_POINTS;
  return points * (1 - normalizedProgress(progress) / 100);
}

/** Due within the next week (not past due) and already open in Canvas. */
export function isNextUpCandidate(
  assignment: Pick<AssignmentItem, "due_at" | "unlock_at">,
  now: number,
) {
  const due = assignment.due_at ? Date.parse(assignment.due_at) : NaN;
  if (!Number.isFinite(due) || due < now || due > now + WEEK_MS) return false;
  // Work that hasn't opened in Canvas yet can't be next up.
  return !notYetOpen(assignment, now);
}

/**
 * The dashboard's Next up: the work due soonest. Two due at the same time go
 * to the one worth more points. The iPhone app picks the same way.
 */
export function selectNextUp<T extends AssignmentItem>(assignments: T[], now: number): T | null {
  return (
    assignments
      .filter((assignment) => isNextUpCandidate(assignment, now))
      .sort(
        (a, b) =>
          Date.parse(a.due_at ?? "") - Date.parse(b.due_at ?? "") ||
          (b.points_possible ?? 0) - (a.points_possible ?? 0) ||
          a.name.localeCompare(b.name),
      )[0] ?? null
  );
}