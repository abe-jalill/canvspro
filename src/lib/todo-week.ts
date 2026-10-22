/** Local calendar dates: adding milliseconds would drift across daylight saving. */
export function startOfLocalDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** This Sunday–Saturday, or one of the next three calendar weeks. */
export function todoWeekDays(now: number, weekOffset = 0): number[] {
  const sunday = new Date(startOfLocalDay(now));
  sunday.setDate(sunday.getDate() - sunday.getDay() + Math.max(0, Math.min(3, weekOffset)) * 7);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(sunday);
    date.setDate(date.getDate() + offset);
    return date.getTime();
  });
}

export function isDueOnDay(item: { due_at: string | null }, day: number): boolean {
  const due = item.due_at ? Date.parse(item.due_at) : NaN;
  return Number.isFinite(due) && startOfLocalDay(due) === startOfLocalDay(day);
}

/** Both class assignments and personal tasks share this rule, including earlier today. */
export function tasksForDay<T extends { due_at: string | null }>(
  items: T[], day: number, isDone: (item: T) => boolean,
): T[] {
  return items.filter((item) => isDueOnDay(item, day) && !isDone(item));
}

/** A new assignment/task starts due today at 11:59 PM in the student's time zone. */
export function defaultTaskDue(now = Date.now()): string {
  const date = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T23:59`;
}
