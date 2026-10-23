/**
 * How far back Completed looks: from the past 2 days to the past 2 months.
 * Saved to the account, so To-Do's Completed, the one in More/Settings on the
 * iPhone and every browser show the same range.
 */
export const COMPLETED_RANGE_KEY = "completed-range";

export const COMPLETED_RANGES = [
  { days: 2, label: "2 days", long: "the past 2 days" },
  { days: 7, label: "Week", long: "the past week" },
  { days: 14, label: "2 weeks", long: "the past 2 weeks" },
  { days: 30, label: "Month", long: "the past month" },
  { days: 60, label: "2 months", long: "the past 2 months" },
] as const;

export type CompletedRangeDays = (typeof COMPLETED_RANGES)[number]["days"];
export const DEFAULT_COMPLETED_RANGE: CompletedRangeDays = 30;

/** A saved value, or the default (a month) for anything else. */
export function readCompletedRange(value: unknown): CompletedRangeDays {
  const match = COMPLETED_RANGES.find((range) => range.days === value);
  return match ? match.days : DEFAULT_COMPLETED_RANGE;
}

/** The first moment in range: local midnight, `days - 1` days before today (today counts). */
export function completedRangeStart(days: number, now = Date.now()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.getTime();
}

/** Finished within the range. Work with no known finish time isn't shown. */
export function inCompletedRange(doneAt: number | null, days: number, now = Date.now()): boolean {
  return doneAt != null && doneAt >= completedRangeStart(days, now);
}
