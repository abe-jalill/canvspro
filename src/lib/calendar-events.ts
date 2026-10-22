/**
 * Your own events and commitments on the Calendar (a club meeting, a study
 * group, an appointment). Saved to the account under this key; the iPhone app
 * reads and writes the same list in the same shape. They never go on To-Do.
 */
export const CALENDAR_EVENTS_KEY = "calendar-events";

export interface CalendarEvent {
  id: string;
  title: string;
  /** Local day of the first (or only) time, "2026-10-22". */
  date: string;
  /** Minutes from midnight; null for an all-day event. */
  start: number | null;
  end: number | null;
  /** Weekdays it repeats on, 0 = Sunday … 6 = Saturday. Empty: just once. */
  repeat: number[];
  /** Last day it repeats ("2026-12-12"), or null for no end. */
  until: string | null;
  location: string;
  notes: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-10-22" → local midnight of that day. */
export function parseDayKey(key: string): Date | null {
  if (!DAY_RE.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 ? date : null;
}

function validMinutes(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 24 * 60;
}

/** The saved list, keeping only well-formed events. */
export function readEvents(value: unknown): CalendarEvent[] {
  if (!Array.isArray(value)) return [];
  const out: CalendarEvent[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Partial<CalendarEvent>;
    if (typeof e.id !== "string" || typeof e.title !== "string" || typeof e.date !== "string")
      continue;
    if (!parseDayKey(e.date)) continue;
    const start = validMinutes(e.start) ? e.start : null;
    const end = start != null && validMinutes(e.end) && e.end > start ? e.end : null;
    out.push({
      id: e.id,
      title: e.title,
      date: e.date,
      start,
      end,
      repeat: Array.isArray(e.repeat)
        ? [
            ...new Set(
              e.repeat.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6),
            ),
          ].sort()
        : [],
      until: typeof e.until === "string" && parseDayKey(e.until) ? e.until : null,
      location: typeof e.location === "string" ? e.location : "",
      notes: typeof e.notes === "string" ? e.notes : "",
    });
  }
  return out;
}

/** Whether the event happens on this local day. */
export function occursOn(event: CalendarEvent, day: Date): boolean {
  const first = parseDayKey(event.date);
  if (!first) return false;
  const key = dayKey(day);
  if (event.repeat.length === 0) return key === event.date;
  if (key < event.date) return false;
  if (event.until && key > event.until) return false;
  return event.repeat.includes(day.getDay());
}

/** "9:30 AM", "12:00 PM". */
export function clockLabel(minutes: number): string {
  const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Every Tue, Thu", "Every day", "Weekdays". */
export function repeatLabel(repeat: number[]): string {
  if (repeat.length === 7) return "Every day";
  if (repeat.length === 5 && [1, 2, 3, 4, 5].every((d) => repeat.includes(d))) return "Weekdays";
  return `Every ${repeat.map((d) => WEEKDAY_SHORT[d]).join(", ")}`;
}

/**
 * A sensible time to put a task on the calendar: late afternoon on the day
 * it's due, early enough to finish before it's due, never in the night, never
 * in the past. Returns an ISO time.
 */
export function suggestedPlanTime(
  dueAt: string | null,
  estimateMinutes = 60,
  now = Date.now(),
): string {
  const HALF_HOUR = 30 * 60_000;
  const due = dueAt ? Date.parse(dueAt) : NaN;
  const base = new Date(Number.isFinite(due) ? due : now);
  base.setHours(16, 0, 0, 0);
  let at = base.getTime();
  if (Number.isFinite(due) && at + estimateMinutes * 60_000 > due) {
    at = Math.floor((due - estimateMinutes * 60_000 - HALF_HOUR) / HALF_HOUR) * HALF_HOUR;
  }
  // Keep it to waking hours: before 8 AM moves to 6 PM the evening before.
  const hour = new Date(at).getHours();
  if (hour < 8) {
    const d = new Date(at);
    d.setDate(d.getDate() - 1);
    d.setHours(18, 0, 0, 0);
    at = d.getTime();
  } else if (hour >= 22) {
    const d = new Date(at);
    d.setHours(21, 0, 0, 0);
    at = d.getTime();
  }
  if (at < now) {
    at = Math.ceil(now / HALF_HOUR) * HALF_HOUR;
    const d = new Date(at);
    // Too late tonight and nothing due before tomorrow afternoon: tomorrow at 4.
    if (d.getHours() >= 22 && (!Number.isFinite(due) || due > at + 18 * 3_600_000)) {
      d.setDate(d.getDate() + 1);
      d.setHours(16, 0, 0, 0);
      at = d.getTime();
    }
  }
  return new Date(at).toISOString();
}

/** A new event's times: the next whole hour, for an hour. */
export function defaultEventTimes(now = new Date()): { date: string; start: number; end: number } {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  let start = next.getHours() * 60;
  if (start < 8 * 60) start = 9 * 60;
  if (start > 21 * 60) {
    next.setDate(next.getDate() + 1);
    start = 9 * 60;
  }
  return { date: dayKey(next), start, end: Math.min(start + 60, 24 * 60 - 1) };
}
