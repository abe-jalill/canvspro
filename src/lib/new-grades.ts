import type { AssignmentItem } from "./canvas.functions.ts";

const DAY_MS = 24 * 60 * 60 * 1_000;

type Graded = Pick<AssignmentItem, "submission">;

/**
 * When a grade showed up for the student: the later of when it was graded and
 * when it was posted (a teacher can grade first and release later), so a
 * regrade or a late release counts as new. Null when there's no grade.
 */
export function gradeArrivedAt(assignment: Graded): number | null {
  const submission = assignment.submission;
  if (!submission || submission.excused) return null;
  if (submission.score == null && !submission.grade) return null;
  const times = [submission.graded_at, submission.posted_at]
    .map((value) => (value ? Date.parse(value) : NaN))
    .filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

/** Grades → New grades: grades that came in over the last 24 hours, newest first. */
export function newGrades<T extends Graded>(assignments: T[], now: number) {
  return assignments
    .map((assignment) => ({ assignment, at: gradeArrivedAt(assignment) }))
    .filter(
      (entry): entry is { assignment: T; at: number } =>
        entry.at != null && entry.at >= now - DAY_MS,
    )
    .sort((a, b) => b.at - a.at);
}

/** "12 min ago", "3 hr ago". */
export function gradedAgo(at: number, now: number) {
  const minutes = Math.max(1, Math.floor((now - at) / 60_000));
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hr ago`;
}
