import { endOfUpcomingDay } from "./assignment-window.ts";

/** The regular list is short; search can reach one local calendar month ahead. */
export function studySessionEnd(now: number, searching: boolean): number {
  if (!searching) return endOfUpcomingDay(now, 10);
  const current = new Date(now);
  const lastDayOfNextMonth = new Date(
    current.getFullYear(),
    current.getMonth() + 2,
    0,
  ).getDate();
  const end = new Date(current);
  end.setDate(1);
  end.setMonth(current.getMonth() + 1);
  end.setDate(Math.min(current.getDate(), lastDayOfNextMonth));
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

/** Undated assignments may be found by search but do not fill the default list. */
export function isInStudySessionWindow(
  dueAt: string | null | undefined,
  now: number,
  searching: boolean,
): boolean {
  if (!dueAt) return searching;
  const due = new Date(dueAt).getTime();
  return Number.isFinite(due) && due <= studySessionEnd(now, searching);
}
