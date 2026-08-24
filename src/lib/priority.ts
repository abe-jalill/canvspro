import type { AssignmentItem } from "@/lib/canvas.functions";

export interface PriorityAssignment {
  assignment: AssignmentItem;
  score: number;
  urgency: "critical" | "high" | "medium" | "low";
  estimatedMinutes: number | null;
}

function hoursUntil(dueAt: string | null, now: number): number | null {
  if (!dueAt) return null;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return null;
  return (t - now) / 36e5;
}

function weightScore(points: number | null): number {
  if (!points || points <= 0) return 0;
  // Heavier assignments get a small bump, but not enough to override time urgency.
  return Math.min(points / 200, 1) * 15;
}

function estimateScore(minutes: number | null): number {
  if (minutes == null || minutes <= 0) return 0;
  // Larger estimates get a small bump so longer tasks surface earlier.
  return Math.min(minutes / 120, 1) * 8;
}

export function computePriority(
  assignment: AssignmentItem,
  now: number,
  courseTotalPoints: number,
  estimatedMinutes: number | null,
): PriorityAssignment {
  const hours = hoursUntil(assignment.due_at, now);
  const points = assignment.points_possible ?? 0;
  const relativeWeight =
    courseTotalPoints > 0 ? (points / courseTotalPoints) * 100 : 0;

  let timeScore = 0;
  let urgency: PriorityAssignment["urgency"] = "low";

  if (hours === null) {
    timeScore = 5;
    urgency = "low";
  } else if (hours < 0) {
    timeScore = 100 + Math.min(Math.abs(hours) / 24, 5) * 2;
    urgency = "critical";
  } else if (hours <= 24) {
    timeScore = 80 + (24 - hours) / 24 * 20;
    urgency = "critical";
  } else if (hours <= 72) {
    timeScore = 50 + (72 - hours) / 48 * 30;
    urgency = "high";
  } else if (hours <= 168) {
    timeScore = 20 + (168 - hours) / 96 * 30;
    urgency = "medium";
  } else {
    timeScore = Math.max(0, 20 - (hours - 168) / 24);
    urgency = "low";
  }

  const score =
    timeScore + weightScore(points) + relativeWeight * 0.5 + estimateScore(estimatedMinutes);
  return { assignment, score, urgency, estimatedMinutes };
}

export interface CourseGroup {
  id: number;
  label: string;
  items: PriorityAssignment[];
}

export interface PriorityOptions {
  /** Estimated minutes per assignment id, if known. */
  estimates?: Record<number, number | null>;
}

export function buildPriorityList(
  assignments: AssignmentItem[],
  courses: { id: number; name: string; course_code: string | null }[],
  isCompleted: ((id: string | number) => boolean) | Set<string | number>,
  now: number,
  options?: PriorityOptions,
): CourseGroup[] {
  const byCourse = new Map<number, AssignmentItem[]>();
  for (const a of assignments) {
    if (isCompleted instanceof Set) {
      if (isCompleted.has(a.id) || isCompleted.has(String(a.id))) continue;
    } else if (isCompleted(a.id)) {
      continue;
    }
    const arr = byCourse.get(a.course_id) ?? [];
    arr.push(a);
    byCourse.set(a.course_id, arr);
  }

  const totals = new Map<number, number>();
  for (const [courseId, items] of byCourse) {
    totals.set(
      courseId,
      items.reduce((sum, a) => sum + (a.points_possible ?? 0), 0),
    );
  }

  const estimates = options?.estimates ?? {};

  const groups: CourseGroup[] = [];
  for (const [courseId, items] of byCourse) {
    if (items.length === 0) continue;
    const total = totals.get(courseId) ?? 0;
    const ranked = items
      .map((a) => computePriority(a, now, total, estimates[a.id] ?? null))
      .sort((a, b) => b.score - a.score);
    const label =
      courses.find((c) => c.id === courseId)?.name ??
      items[0]?.course_name ??
      "Unknown class";
    groups.push({ id: courseId, label, items: ranked });
  }

  // Sort groups so the one with the highest-priority item comes first.
  groups.sort((a, b) => {
    const am = a.items[0]?.score ?? 0;
    const bm = b.items[0]?.score ?? 0;
    return bm - am;
  });

  return groups;
}

function isDone(
  a: AssignmentItem,
  completedIds: Set<string | number>,
): boolean {
  if (completedIds.has(a.id) || completedIds.has(String(a.id))) return true;
  const s = a.submission;
  return Boolean(s?.submitted_at) || s?.workflow_state === "graded";
}

export function describePriorityList(groups: CourseGroup[]): string {
  if (groups.length === 0) return "No unfinished assignments right now.";

  const parts: string[] = [];
  for (const g of groups.slice(0, 3)) {
    const names = g.items
      .slice(0, 2)
      .map((p) => p.assignment.name)
      .join(" and ");
    if (names) {
      parts.push(`${names} from ${g.label}`);
    }
  }

  if (parts.length === 0) return "No unfinished assignments right now.";

  const last = parts.length > 1 ? `, then ${parts.slice(1).join("; then ")}` : "";
  return `Right now, finish ${parts[0]}${last}.`;
}
