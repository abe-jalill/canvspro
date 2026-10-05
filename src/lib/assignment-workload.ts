import type { AssignmentItem } from "./canvas.functions.ts";

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

export function nextUpPriority(
  assignment: Pick<AssignmentItem, "due_at" | "points_possible">,
  progress: number | null | undefined,
  now: number,
) {
  const due = assignment.due_at ? Date.parse(assignment.due_at) : NaN;
  if (!Number.isFinite(due) || due < now || due > now + WEEK_MS) return Number.NEGATIVE_INFINITY;

  const deadlineScore = 60 * (1 - (due - now) / WEEK_MS);
  const impactScore = 35 * Math.min(1, Math.log1p(remainingWork(assignment, progress)) / Math.log1p(100));
  const unfinishedScore = 5 * (1 - normalizedProgress(progress) / 100);
  return deadlineScore + impactScore + unfinishedScore;
}

export function selectWeightedNextUp<T extends AssignmentItem>(
  assignments: T[],
  progressById: ReadonlyMap<number, number | null | undefined>,
  now: number,
) {
  return assignments
    .map((assignment) => ({
      assignment,
      score: nextUpPriority(assignment, progressById.get(assignment.id), now),
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Date.parse(a.assignment.due_at ?? "") - Date.parse(b.assignment.due_at ?? "");
    })[0]?.assignment ?? null;
}