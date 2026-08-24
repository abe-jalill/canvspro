// Class-schedule types and helpers.
// Each user's recurring class meeting times live in the database
// (`class_schedule_entries`); nothing personal is hardcoded here.
// Days use the single-letter Canvas convention: M T W R (Thu) F.

export type ClassDay = "M" | "T" | "W" | "R" | "F";

export interface ClassSession {
  id: string;
  code: string;
  section: string;
  title: string;
  displayName: string;
  crn: string;
  credits: number;
  instructor: string;
  location: string;
  campus: string;
  scheduleType: string;
  days: ClassDay[];
  startMinutes: number; // minutes from midnight
  endMinutes: number;
  timeLabel: string;
  dateRange: string;
  term: string;
}

export const DAY_LABELS: Record<ClassDay, string> = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  R: "Thursday",
  F: "Friday",
};

export const DAY_ORDER: ClassDay[] = ["M", "T", "W", "R", "F"];

export function isClassDay(v: string): v is ClassDay {
  return (DAY_ORDER as string[]).includes(v);
}

/** "14:05" -> minutes from midnight. Returns null when unparseable. */
export function parseTimeInput(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutes from midnight -> "14:05" (for <input type="time">). */
export function toTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function minutesToLabel(m: number): string {
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${period}`;
}

/** "12:30 – 1:45 PM" style range label. */
export function timeRangeLabel(start: number, end: number): string {
  const startPm = Math.floor(start / 60) >= 12;
  const endPm = Math.floor(end / 60) >= 12;
  const startLabel = startPm === endPm
    ? minutesToLabel(start).replace(/\s(AM|PM)$/, "")
    : minutesToLabel(start);
  return `${startLabel} – ${minutesToLabel(end)}`;
}

export function totalCredits(sessions: ClassSession[]): number {
  return sessions.reduce((s, c) => s + (Number(c.credits) || 0), 0);
}

export function sessionsByDay(
  sessions: ClassSession[],
): Record<ClassDay, ClassSession[]> {
  const out: Record<ClassDay, ClassSession[]> = {
    M: [],
    T: [],
    W: [],
    R: [],
    F: [],
  };
  for (const s of sessions) {
    for (const d of s.days) out[d]?.push(s);
  }
  for (const d of DAY_ORDER) {
    out[d].sort((a, b) => a.startMinutes - b.startMinutes);
  }
  return out;
}

/** Minimal shape needed to detect time overlaps. */
export interface ConflictItem {
  key: string;
  title: string;
  days: ClassDay[];
  startMinutes: number;
  endMinutes: number;
}

export interface ScheduleConflict {
  day: ClassDay;
  a: ConflictItem;
  b: ConflictItem;
}

/**
 * Finds pairs of meetings that share a day and overlap in time.
 * Two meetings of the same class (same key) are still compared, since a class
 * with per-day times can be mis-entered too.
 */
export function findScheduleConflicts(
  items: ConflictItem[],
): ScheduleConflict[] {
  const out: ScheduleConflict[] = [];
  for (const day of DAY_ORDER) {
    const onDay = items
      .filter((i) => i.days.includes(day))
      .sort((a, b) => a.startMinutes - b.startMinutes);
    for (let i = 0; i < onDay.length; i++) {
      for (let j = i + 1; j < onDay.length; j++) {
        const a = onDay[i];
        const b = onDay[j];
        if (b.startMinutes >= a.endMinutes) break;
        if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
          out.push({ day, a, b });
        }
      }
    }
  }
  return out;
}

/** Human-readable one-liner for a conflict. */
export function conflictLabel(c: ScheduleConflict): string {
  const a = `${c.a.title || "Untitled class"} (${timeRangeLabel(c.a.startMinutes, c.a.endMinutes)})`;
  const b = `${c.b.title || "Untitled class"} (${timeRangeLabel(c.b.startMinutes, c.b.endMinutes)})`;
  return `${DAY_LABELS[c.day]}: ${a} overlaps ${b}`;
}
