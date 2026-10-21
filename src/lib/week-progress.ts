import type { AssignmentItem } from "./canvas.functions.ts";

const DAY_MS = 24 * 60 * 60 * 1_000;

export interface DayProgress {
  /** Start of the day (local time). */
  date: number;
  /** Assignments due that day. */
  total: number;
  /** How many of them are done (ticked here or submitted in Canvas). */
  done: number;
}

function startOfDay(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Today's week strip: each of the seven days from today, with what's due and
 * how much of it is done. The same counting as the iPhone app: finished work
 * counts toward its day, unfinished work only while it's still shown.
 */
export function weekProgress<T extends Pick<AssignmentItem, "due_at">>(
  assignments: T[],
  isDone: (assignment: T) => boolean,
  isShown: (assignment: T) => boolean,
  now: number,
): DayProgress[] {
  const today = startOfDay(now);
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return date.getTime();
  });
  const end = days[6] + DAY_MS * 1.5;
  const byDay = new Map<number, { total: number; done: number }>();
  for (const assignment of assignments) {
    const due = assignment.due_at ? Date.parse(assignment.due_at) : NaN;
    if (!Number.isFinite(due) || due < today || due >= end) continue;
    const day = startOfDay(due);
    if (!days.includes(day)) continue;
    const done = isDone(assignment);
    if (!done && !isShown(assignment)) continue;
    const entry = byDay.get(day) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (done) entry.done += 1;
    byDay.set(day, entry);
  }
  return days.map((date) => ({
    date,
    total: byDay.get(date)?.total ?? 0,
    done: byDay.get(date)?.done ?? 0,
  }));
}
