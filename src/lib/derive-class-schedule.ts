// Derives a weekly class timetable from live Canvas calendar events.
// Canvas has no "meeting times" endpoint, so recurring class meetings are
// inferred from the calendar events of the user's active courses.
import type { CalendarEventItem } from "@/lib/canvas.functions";
import { displayCourseName } from "@/lib/course-display";

export type ClassDay = "M" | "T" | "W" | "R" | "F";

export const DAY_LABELS: Record<ClassDay, string> = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  R: "Thursday",
  F: "Friday",
};

export const DAY_ORDER: ClassDay[] = ["M", "T", "W", "R", "F"];

const WEEKDAY_TO_DAY: Record<number, ClassDay | undefined> = {
  1: "M",
  2: "T",
  3: "W",
  4: "R",
  5: "F",
};

export interface DerivedSession {
  id: string;
  title: string;
  displayName: string;
  context: string;
  location: string;
  days: ClassDay[];
  startMinutes: number;
  endMinutes: number;
  timeLabel: string;
  occurrences: number;
}

export function minutesToLabel(m: number): string {
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${period}`;
}

function rangeLabel(start: number, end: number) {
  return `${minutesToLabel(start)} – ${minutesToLabel(end)}`;
}

/**
 * Groups calendar events into weekly recurring meetings.
 * Events sharing a title, weekday and time slot collapse into one session.
 */
export function deriveWeeklySchedule(
  events: CalendarEventItem[],
): DerivedSession[] {
  type Slot = {
    title: string;
    context: string;
    location: string;
    day: ClassDay;
    startMinutes: number;
    endMinutes: number;
    occurrences: number;
  };

  const slots = new Map<string, Slot>();

  for (const e of events) {
    if (!e.start_at) continue;
    const start = new Date(e.start_at);
    const day = WEEKDAY_TO_DAY[start.getDay()];
    if (!day) continue;
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const end = e.end_at ? new Date(e.end_at) : null;
    const endMinutes = end
      ? end.getHours() * 60 + end.getMinutes()
      : startMinutes + 60;
    if (endMinutes <= startMinutes) continue;

    const title = (e.title ?? "").trim() || "Class";
    const context = e.context_name
      ? displayCourseName(e.context_name, undefined)
      : "";
    const key = `${title.toLowerCase()}|${day}|${startMinutes}|${endMinutes}`;
    const existing = slots.get(key);
    if (existing) {
      existing.occurrences += 1;
      if (!existing.location && e.location_name) {
        existing.location = e.location_name;
      }
    } else {
      slots.set(key, {
        title,
        context,
        location: e.location_name ?? "",
        day,
        startMinutes,
        endMinutes,
        occurrences: 1,
      });
    }
  }

  // Collapse the same meeting across weekdays into one session with day list.
  const sessions = new Map<string, DerivedSession>();
  for (const s of slots.values()) {
    const key = `${s.title.toLowerCase()}|${s.startMinutes}|${s.endMinutes}|${s.context.toLowerCase()}`;
    const existing = sessions.get(key);
    if (existing) {
      if (!existing.days.includes(s.day)) existing.days.push(s.day);
      existing.occurrences += s.occurrences;
      if (!existing.location && s.location) existing.location = s.location;
    } else {
      sessions.set(key, {
        id: key,
        title: s.title,
        displayName: s.context || s.title,
        context: s.context,
        location: s.location,
        days: [s.day],
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        timeLabel: rangeLabel(s.startMinutes, s.endMinutes),
        occurrences: s.occurrences,
      });
    }
  }

  const out = Array.from(sessions.values());
  out.forEach((s) =>
    s.days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)),
  );
  out.sort(
    (a, b) =>
      a.startMinutes - b.startMinutes ||
      DAY_ORDER.indexOf(a.days[0]!) - DAY_ORDER.indexOf(b.days[0]!),
  );
  return out;
}

export function sessionsByDay(
  sessions: DerivedSession[],
): Record<ClassDay, DerivedSession[]> {
  const out: Record<ClassDay, DerivedSession[]> = {
    M: [],
    T: [],
    W: [],
    R: [],
    F: [],
  };
  for (const s of sessions) for (const d of s.days) out[d].push(s);
  for (const d of DAY_ORDER) out[d].sort((a, b) => a.startMinutes - b.startMinutes);
  return out;
}

export function scheduleBounds(sessions: DerivedSession[]) {
  if (sessions.length === 0) return { start: 8 * 60, end: 18 * 60 };
  const min = Math.min(...sessions.map((s) => s.startMinutes));
  const max = Math.max(...sessions.map((s) => s.endMinutes));
  return {
    start: Math.floor(min / 60) * 60,
    end: Math.ceil(max / 60) * 60,
  };
}
