import type { AssignmentItem } from "@/lib/canvas.functions";
import {
  endOfUpcomingDay,
  isAssignmentComplete,
  isAssignmentVisible,
  isStaleOverdue,
} from "./assignment-window.ts";
import { notYetOpen } from "./assignment-availability.ts";

function opensAt(assignment: AssignmentItem): number {
  const at = assignment.unlock_at ? Date.parse(assignment.unlock_at) : NaN;
  return Number.isFinite(at) ? at : 0;
}

/**
 * Work that hasn't opened in Canvas yet can't be started, so it always ranks
 * below open work, however close its due date; closed work is ordered by when
 * it opens. Returns 0 when both are open (or both closed at the same time).
 */
export function compareOpenFirst(a: AssignmentItem, b: AssignmentItem, now: number): number {
  const aClosed = notYetOpen(a, now);
  const bClosed = notYetOpen(b, now);
  if (aClosed !== bClosed) return aClosed ? 1 : -1;
  return aClosed ? opensAt(a) - opensAt(b) : 0;
}

export interface PlanInput {
  assignments: AssignmentItem[];
  completed: (id: string | number) => boolean;
  estimates?: Map<number, number | null>;
  skipped?: Set<string>;
  now?: number;
  manualOrder?: string[];
  maxMinutes?: number;
}

export interface RankedAssignment {
  assignment: AssignmentItem;
  score: number;
  estimatedMinutes: number | null;
  dueSoonCount: number;
  explanation: string;
  reasons: string[];
}

export interface PlanItem extends RankedAssignment {
  plannedMinutes: number;
}

const DAY = 24 * 60 * 60 * 1000;

function dueTime(assignment: AssignmentItem): number | null {
  if (!assignment.due_at) return null;
  const due = new Date(assignment.due_at).getTime();
  return Number.isFinite(due) ? due : null;
}

export function filterAssignmentsForUpcomingWindow(
  assignments: AssignmentItem[],
  now: number,
  days: 7 | 14,
): AssignmentItem[] {
  // "Next week" is a calendar window in the student's local time. A rolling
  // 168-hour cutoff at noon would incorrectly hide work due later on the
  // seventh day (Canvas assignments commonly use 11:59 PM deadlines).
  const end = endOfUpcomingDay(now, days);
  return assignments.filter((assignment) => {
    const due = dueTime(assignment);
    return due != null && due >= now && due <= end;
  });
}

export function assignmentIsComplete(
  assignment: AssignmentItem,
  completed: (id: string | number) => boolean,
) {
  return isAssignmentComplete(assignment, completed(assignment.id));
}

export function defaultEstimateMinutes(assignment: AssignmentItem): number {
  if (assignment.estimated_minutes != null && Number.isFinite(assignment.estimated_minutes) && assignment.estimated_minutes > 0) {
    return assignment.estimated_minutes;
  }
  const points = assignment.points_possible ?? 0;
  if (points >= 100) return 90;
  if (points >= 50) return 60;
  if (points >= 20) return 45;
  return 30;
}

function humanDue(due: number | null, now: number) {
  if (due == null) return "no due date";
  const diff = due - now;
  const abs = Math.abs(diff);
  if (diff < 0) {
    const days = Math.max(1, Math.ceil(abs / DAY));
    return days === 1 ? "overdue" : `${days} days overdue`;
  }
  if (diff <= DAY) return "due within 24 hours";
  if (diff <= 3 * DAY) return "due within 3 days";
  if (diff <= 7 * DAY) return "due this week";
  return "due later";
}

export function rankGetItDoneAssignments(input: PlanInput): RankedAssignment[] {
  const now = input.now ?? Date.now();
  const active = input.assignments.filter(
    (assignment) =>
      !assignmentIsComplete(assignment, input.completed) &&
      !isStaleOverdue(assignment, now) &&
      !input.skipped?.has(String(assignment.id)),
  );
  const dueSoonByCourse = new Map<number, number>();
  for (const assignment of active) {
    const due = dueTime(assignment);
    if (due != null && due >= now && due <= now + 3 * DAY) {
      dueSoonByCourse.set(assignment.course_id, (dueSoonByCourse.get(assignment.course_id) ?? 0) + 1);
    }
  }

  return active
    .map((assignment) => {
      const due = dueTime(assignment);
      const hours = due == null ? null : (due - now) / 36e5;
      const estimatedMinutes = input.estimates?.get(assignment.id) ?? null;
      const plannedMinutes = estimatedMinutes ?? defaultEstimateMinutes(assignment);
      const dueSoonCount = dueSoonByCourse.get(assignment.course_id) ?? 0;
      const points = assignment.points_possible ?? 0;

      let score = 0;
      const reasons: string[] = [];
      if (hours == null) {
        score += 8;
        reasons.push("it has no due date, so it is lower pressure");
      } else if (hours < 0) {
        score += 120 + Math.min(Math.abs(hours) / 24, 7) * 3;
        reasons.push("it is overdue");
      } else if (hours <= 12) {
        score += 105;
        reasons.push("it is due soon");
      } else if (hours <= 24) {
        score += 92;
        reasons.push("it is due within 24 hours");
      } else if (hours <= 72) {
        score += 70 - (hours / 72) * 12;
        reasons.push("it is due within 3 days");
      } else if (hours <= 168) {
        score += 38 - (hours / 168) * 8;
        reasons.push("it is due this week");
      } else {
        score += 10;
      }

      if (points > 0) {
        score += Math.min(points / 100, 1) * 16;
        if (points >= 50) reasons.push("it carries a lot of points");
      }
      if (estimatedMinutes != null) {
        score += Math.min(estimatedMinutes / 90, 1) * 8;
        if (estimatedMinutes >= 60) reasons.push("it needs a longer work block");
      } else {
        score += Math.min(plannedMinutes / 90, 1) * 4;
      }
      if (dueSoonCount > 1) {
        score += Math.min(dueSoonCount, 4) * 5;
        reasons.push(`${dueSoonCount} assignments in this class are due soon`);
      }

      const explanationReasons = reasons.filter((reason) => !reason.includes("lower pressure"));
      const explanation =
        explanationReasons.length > 0
          ? `Recommended because ${explanationReasons.slice(0, 2).join(" and ")}.`
          : `Recommended because it is the strongest next task with ${humanDue(due, now)}.`;

      return {
        assignment,
        score,
        estimatedMinutes,
        dueSoonCount,
        explanation,
        reasons,
      };
    })
    .sort((a, b) => {
      const open = compareOpenFirst(a.assignment, b.assignment, now);
      if (open !== 0) return open;
      if (b.score !== a.score) return b.score - a.score;
      const ad = dueTime(a.assignment) ?? Number.POSITIVE_INFINITY;
      const bd = dueTime(b.assignment) ?? Number.POSITIVE_INFINITY;
      return ad - bd;
    });
}

export type PriorityUrgency = "critical" | "high" | "medium" | "low";

/**
 * Label shown beside an assignment, from time until the due date alone.
 * Position in the list also weighs points and estimates, so a heavy item due
 * in two days can occasionally sit above a light one due tonight.
 */
export function urgencyForAssignment(assignment: AssignmentItem, now: number): PriorityUrgency {
  const due = dueTime(assignment);
  if (due == null) return "low";
  const hours = (due - now) / 36e5;
  if (hours <= 24) return "critical";
  if (hours <= 72) return "high";
  if (hours <= 168) return "medium";
  return "low";
}

export interface PriorityQueueItem extends RankedAssignment {
  urgency: PriorityUrgency;
}

/** Priority Assignments looks this many days ahead (through the end of the last one). */
export const PRIORITY_WINDOW_DAYS = 5;

/**
 * Every class's open work due in the next five days, ordered by the same
 * scorer Get It Done uses. The Assignments page and the dashboard widget both
 * read this, so the same assignment is never ranked differently on different
 * pages.
 */
export function buildPriorityQueue(input: {
  assignments: AssignmentItem[];
  completed: (id: string | number) => boolean;
  estimates?: Map<number, number | null>;
  now?: number;
}): PriorityQueueItem[] {
  const now = input.now ?? Date.now();
  const end = endOfUpcomingDay(now, PRIORITY_WINDOW_DAYS);
  // Priority is about deadlines, so work with no due date is left out, and so
  // is anything due further out than the window: it can wait.
  const visible = input.assignments.filter((assignment) => {
    const due = dueTime(assignment);
    return (
      due != null &&
      due <= end &&
      isAssignmentVisible(assignment, input.completed(assignment.id), false, now)
    );
  });
  return rankGetItDoneAssignments({
    assignments: visible,
    completed: input.completed,
    estimates: input.estimates,
    now,
  }).map((item) => ({ ...item, urgency: urgencyForAssignment(item.assignment, now) }));
}

/** What Priority Assignments says when nothing is due in the window. */
export const NOTHING_DUE_SOON = "Nothing due soon, relax.";

/** Shown one at a time under NOTHING_DUE_SOON, each for a few seconds. */
export const RESTFUL_PHRASES = [
  "Take a slow breath in, and let it all the way out.",
  "Drop your shoulders and unclench your jaw.",
  "Look at something far away for a moment.",
  "A glass of water would be nice right now.",
  "Step outside and notice the air.",
  "Rest is part of the work.",
  "Stretch your arms up, then let them fall.",
  "Let your mind wander for a while.",
  "You've done enough for now.",
  "Close your eyes and count five slow breaths.",
] as const;

/** One-line summary of what to do next, e.g. "Right now, finish A (Bio), then B (Chem)." */
export function describePriorityQueue(
  queue: PriorityQueueItem[],
  courseLabel: (assignment: AssignmentItem) => string = (a) => a.course_name,
): string {
  if (queue.length === 0) return NOTHING_DUE_SOON;
  const [first, ...rest] = queue.slice(0, 3).map(
    ({ assignment }) => `${assignment.name} (${courseLabel(assignment)})`,
  );
  return `Right now, finish ${first}${rest.length ? `, then ${rest.join(", then ")}` : ""}.`;
}

export function buildTodayPlan(input: PlanInput): PlanItem[] {
  const maxMinutes = input.maxMinutes ?? 240;
  const ranked = rankGetItDoneAssignments(input);
  const manual = new Map((input.manualOrder ?? []).map((id, index) => [id, index]));
  const ordered = [...ranked].sort((a, b) => {
    const ai = manual.get(String(a.assignment.id));
    const bi = manual.get(String(b.assignment.id));
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    const open = compareOpenFirst(a.assignment, b.assignment, input.now ?? Date.now());
    if (open !== 0) return open;
    return b.score - a.score;
  });

  const plan: PlanItem[] = [];
  let total = 0;
  for (const item of ordered) {
    const due = dueTime(item.assignment);
    const plannedMinutes = item.estimatedMinutes ?? defaultEstimateMinutes(item.assignment);
    const shouldInclude =
      due == null ||
      due < (input.now ?? Date.now()) ||
      due <= (input.now ?? Date.now()) + 3 * DAY ||
      plan.length < 3;
    if (!shouldInclude) continue;
    if (plan.length >= 3 && total + plannedMinutes > maxMinutes) continue;
    plan.push({ ...item, plannedMinutes });
    total += plannedMinutes;
    if (plan.length >= 6) break;
  }
  return plan;
}
