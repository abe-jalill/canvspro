import type { CalendarEntry } from "./calendar-agenda.ts";

/**
 * The Calendar's views, laid out the way Google Calendar does: Day and Week
 * as an hour grid, Month as a six-week grid, Schedule as a list. Weeks start
 * on Sunday.
 */
export type CalendarView = "day" | "week" | "month" | "schedule";

export const CALENDAR_VIEWS: { id: CalendarView; label: string; key: string }[] = [
  { id: "day", label: "Day", key: "D" },
  { id: "week", label: "Week", key: "W" },
  { id: "month", label: "Month", key: "M" },
  { id: "schedule", label: "Schedule", key: "A" },
];

/** Google Calendar's event colors. */
export const GOOGLE_COLORS = {
  tomato: "#D50000",
  flamingo: "#E67C73",
  tangerine: "#F4511E",
  banana: "#F6BF26",
  sage: "#33B679",
  basil: "#0B8043",
  peacock: "#039BE5",
  blueberry: "#3F51B5",
  lavender: "#7986CB",
  grape: "#8E24AA",
  graphite: "#616161",
} as const;

/** One color per class, in the order Canvas lists them (Peacock is kept for your events). */
const CLASS_PALETTE = [
  GOOGLE_COLORS.sage,
  GOOGLE_COLORS.tangerine,
  GOOGLE_COLORS.grape,
  GOOGLE_COLORS.flamingo,
  GOOGLE_COLORS.basil,
  GOOGLE_COLORS.lavender,
  GOOGLE_COLORS.tomato,
  GOOGLE_COLORS.blueberry,
];

export function classCalendarColor(courseId: number, courseIds: readonly number[]): string {
  const index = courseIds.indexOf(courseId);
  return CLASS_PALETTE[(index >= 0 ? index : Math.abs(courseId)) % CLASS_PALETTE.length];
}

export const HOUR_HEIGHT = 48;
/** Day and Week show 5 AM to midnight (the last hour is 11 PM). */
export const DAY_START_HOUR = 5;
export const DAY_START_MINUTES = DAY_START_HOUR * 60;
export const DAY_HOURS = 24 - DAY_START_HOUR;
/** A due date or planned work has no length; it's drawn as half an hour. */
export const POINT_MINUTES = 30;

export function startOfDay(t: number | Date): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** The Sunday on or before this day. */
export function startOfWeek(day: Date): Date {
  return addDays(startOfDay(day), -day.getDay());
}

/** Six weeks from the Sunday on or before the 1st, as Google's month grid (five when they fit). */
export function monthGrid(anchor: Date): Date[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i));
    // A last week that's entirely next month is left off.
    if (w >= 4 && week[0].getMonth() !== anchor.getMonth()) break;
    weeks.push(week);
  }
  return weeks;
}

/** The days a view shows around its anchor day. */
export function viewDays(view: CalendarView, anchor: Date): Date[] {
  if (view === "day") return [startOfDay(anchor)];
  if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
  if (view === "month") return monthGrid(anchor).flat();
  return Array.from({ length: 30 }, (_, i) => addDays(startOfDay(anchor), i));
}

/** The next (1) or previous (-1) page of a view. */
export function stepAnchor(view: CalendarView, anchor: Date, direction: 1 | -1): Date {
  if (view === "day") return addDays(anchor, direction);
  if (view === "week") return addDays(anchor, 7 * direction);
  if (view === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  return addDays(anchor, 30 * direction);
}

/** A short title for phones: "Oct 23" for a day, else the month ("October"). */
export function shortViewTitle(view: CalendarView, anchor: Date): string {
  if (view === "day")
    return anchor.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const days = viewDays(view, anchor);
  const middle = view === "month" ? anchor : days[Math.floor(days.length / 2)];
  return middle.toLocaleDateString(undefined, { month: "long" });
}

/** "October 2026"; a week across months: "Sep – Oct 2026"; across years: "Dec 2026 – Jan 2027". */
export function viewTitle(view: CalendarView, anchor: Date): string {
  if (view === "day") {
    return anchor.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }
  if (view === "month")
    return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const days = viewDays(view, anchor);
  const first = days[0];
  const last = days[days.length - 1];
  if (first.getMonth() === last.getMonth()) {
    return first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  return first.getFullYear() === last.getFullYear()
    ? `${month(first)} – ${month(last)} ${last.getFullYear()}`
    : `${month(first)} ${first.getFullYear()} – ${month(last)} ${last.getFullYear()}`;
}

export interface PlacedEntry {
  entry: CalendarEntry;
  /** Minutes from midnight. */
  start: number;
  end: number;
  /** Side by side with what it overlaps: its column, of how many. */
  column: number;
  columns: number;
}

/**
 * Timed entries on one day, each given a column so overlapping ones sit side
 * by side (as Google draws them). All-day entries are left out.
 */
export function layoutDay(entries: CalendarEntry[], day: Date): PlacedEntry[] {
  const midnight = startOfDay(day).getTime();
  const items = entries
    .filter((e) => !e.allDay)
    .map((entry) => {
      // Anything before 5 AM is drawn at the top of the day.
      let start = Math.max(DAY_START_MINUTES, Math.round((entry.start - midnight) / 60_000));
      const point = entry.end == null;
      // Something due at 11:59 PM sits at the end of the day, not past it.
      if (point) start = Math.min(start, 24 * 60 - POINT_MINUTES);
      const rawEnd = point ? start + POINT_MINUTES : Math.round((entry.end! - midnight) / 60_000);
      // At least a quarter of an hour tall, and never past midnight.
      const end = Math.min(24 * 60, Math.max(rawEnd, start + 15));
      return { entry, start, end, column: 0, columns: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const placed: PlacedEntry[] = [];
  let cluster: PlacedEntry[] = [];
  let clusterEnd = -1;
  const close = () => {
    const columns = Math.max(1, ...cluster.map((p) => p.column + 1));
    for (const p of cluster) p.columns = columns;
    placed.push(...cluster);
    cluster = [];
  };
  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) close();
    // The first column whose last entry has ended.
    const taken = new Set(cluster.filter((p) => p.end > item.start).map((p) => p.column));
    let column = 0;
    while (taken.has(column)) column++;
    item.column = column;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length > 0) close();
  return placed;
}

/** "9am", "9:30am", "12pm", as Google labels short times. */
export function shortTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/** "9 – 10:15am", or "11am – 1pm" when the halves differ. */
export function timeRange(start: number, end: number | null): string {
  if (end == null) return shortTime(start);
  const sameHalf = new Date(start).getHours() < 12 === new Date(end).getHours() < 12;
  const first = shortTime(start);
  return `${sameHalf ? first.replace(/(am|pm)$/, "") : first} – ${shortTime(end)}`;
}

/** "1 AM" … "11 PM" for the hour gutter. */
export function hourLabel(hour: number): string {
  if (hour === 0) return "";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

/** The time zone, short ("GMT-04", "EDT"), for the corner of the grid. */
export function timeZoneLabel(now = new Date()): string {
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const minutes = Math.abs(offset) % 60;
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}
