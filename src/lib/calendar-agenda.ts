import type { AssignmentItem, CalendarEventItem } from "./canvas.functions.ts";
import type { CalendarPick } from "./calendar-picks.ts";
import type { ClassDay } from "./class-schedule.ts";
import { occursOn, type CalendarEvent } from "./calendar-events.ts";

/**
 * One thing on the Calendar: a class meeting, your own event, a task you put
 * on the calendar, a due date, or a Canvas event.
 */
export type EntryKind = "class" | "event" | "planned" | "due" | "canvas";

export interface CalendarEntry {
  key: string;
  kind: EntryKind;
  title: string;
  /** Start time (ms). For an all-day entry, the day's midnight. */
  start: number;
  end: number | null;
  allDay: boolean;
  /** The class, or where it is. */
  context: string;
  courseId?: number;
  assignmentId?: number;
  eventId?: string;
}

export interface ClassMeeting {
  id: string;
  title: string;
  days: ClassDay[];
  startMinutes: number;
  endMinutes: number;
  location: string;
  courseId: number | null;
}

export interface CalendarSources {
  classes: ClassMeeting[];
  events: CalendarEvent[];
  picks: CalendarPick[];
  /** Unfinished work to show at its due time (planned ones are left out by the caller). */
  due: AssignmentItem[];
  canvas: CalendarEventItem[];
  courseName: (
    assignment: Pick<AssignmentItem, "course_id" | "course_name" | "course_code">,
  ) => string;
}

const LETTER_DAY: Record<ClassDay, number> = { M: 1, T: 2, W: 3, R: 4, F: 5 };
const KIND_ORDER: Record<EntryKind, number> = { class: 0, event: 1, canvas: 2, planned: 3, due: 4 };

function at(day: Date, minutes: number): number {
  const d = new Date(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.getTime();
}

function sameDay(ms: number, day: Date): boolean {
  const d = new Date(ms);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

function isMidnight(ms: number): boolean {
  const d = new Date(ms);
  return d.getHours() === 0 && d.getMinutes() === 0;
}

/** Everything on one local day, all-day first, then by time. */
export function entriesForDay(
  day: Date,
  src: CalendarSources,
  options: { classes?: boolean } = {},
): CalendarEntry[] {
  const midnight = new Date(day);
  midnight.setHours(0, 0, 0, 0);
  const out: CalendarEntry[] = [];

  if (options.classes !== false) {
    for (const c of src.classes) {
      if (!c.days.some((d) => LETTER_DAY[d] === midnight.getDay())) continue;
      out.push({
        key: `class-${c.id}-${midnight.getTime()}`,
        kind: "class",
        title: c.title,
        start: at(midnight, c.startMinutes),
        end: at(midnight, c.endMinutes),
        allDay: false,
        context: c.location,
        courseId: c.courseId ?? undefined,
      });
    }
  }

  for (const e of src.events) {
    if (!occursOn(e, midnight)) continue;
    out.push({
      key: `event-${e.id}-${midnight.getTime()}`,
      kind: "event",
      title: e.title,
      start: e.start == null ? midnight.getTime() : at(midnight, e.start),
      end: e.start != null && e.end != null ? at(midnight, e.end) : null,
      allDay: e.start == null,
      context: e.location,
      eventId: e.id,
    });
  }

  for (const p of src.picks) {
    const when = Date.parse(p.at);
    if (!Number.isFinite(when) || !sameDay(when, midnight)) continue;
    out.push({
      key: `pick-${p.assignmentId}`,
      kind: "planned",
      title: p.title,
      start: when,
      end: null,
      allDay: false,
      context: p.context,
      assignmentId: p.assignmentId,
    });
  }

  for (const a of src.due) {
    const when = a.due_at ? Date.parse(a.due_at) : NaN;
    if (!Number.isFinite(when) || !sameDay(when, midnight)) continue;
    out.push({
      key: `due-${a.id}`,
      kind: "due",
      title: a.name,
      start: when,
      end: null,
      allDay: false,
      context: src.courseName(a),
      courseId: a.course_id,
      assignmentId: a.id,
    });
  }

  for (const e of src.canvas) {
    const when = e.start_at ? Date.parse(e.start_at) : NaN;
    if (!Number.isFinite(when) || !sameDay(when, midnight)) continue;
    const end = e.end_at ? Date.parse(e.end_at) : NaN;
    // Canvas marks all-day events as midnight to midnight (or no length at all).
    const allDay = isMidnight(when) && (!Number.isFinite(end) || end === when || isMidnight(end));
    out.push({
      key: `canvas-${e.id}`,
      kind: "canvas",
      title: e.title,
      start: when,
      end: !allDay && Number.isFinite(end) && end > when ? end : null,
      allDay,
      context: e.context_name ?? e.location_name ?? "",
    });
  }

  return out.sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) ||
      a.start - b.start ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.title.localeCompare(b.title),
  );
}

/** "9:30 AM" or "All day"; with an end, "9:30 – 10:45 AM". */
export function entryTimeLabel(entry: Pick<CalendarEntry, "start" | "end" | "allDay">): string {
  if (entry.allDay) return "All day";
  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return entry.end ? `${fmt(entry.start)} – ${fmt(entry.end)}` : fmt(entry.start);
}
