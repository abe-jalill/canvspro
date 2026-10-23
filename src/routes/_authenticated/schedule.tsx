import { TimePicker } from "@/components/ui/time-picker";
import { useClassAssignments } from "@/hooks/use-class-assignments";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlignLeft, BookOpen, Clock, MapPin, Pencil, Repeat, Trash2, X } from "lucide-react";
import { displayCourseName, displayCourseNameForCourse } from "@/lib/course-display";
import { isAssignmentVisible } from "@/lib/assignment-window";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import {
  calendarQueryOptions as eventsQO,
  assignmentsQueryOptions as assignmentsQO,
  coursesQueryOptions as coursesQO,
} from "@/lib/canvas.queries";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { useCalendarPicks } from "@/lib/calendar-picks";
import { repeatLabel, type CalendarEvent } from "@/lib/calendar-events";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import {
  entriesForDay,
  type CalendarEntry,
  type CalendarSources,
  type ClassMeeting,
} from "@/lib/calendar-agenda";
import { GOOGLE_COLORS, classCalendarColor, timeRange } from "@/lib/calendar-grid";
import { GoogleCalendar, type CalendarSourceInfo } from "@/components/calendar/google-calendar";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { useClassSchedule } from "@/lib/user-class-schedule";
import { matchScheduleCourse } from "@/lib/class-schedule";
import { useCustomAssignments } from "@/lib/custom-assignments";
import { CalendarEventDialog } from "@/components/calendar-event-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Calendar — CoursePro" },
      {
        name: "description",
        content: "Your classes, events, planned work and due dates, day by day.",
      },
      { property: "og:title", content: "Calendar — CoursePro" },
      {
        property: "og:description",
        content: "Your classes, events, planned work and due dates, day by day.",
      },
    ],
  }),
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(eventsQO);
      void context.queryClient.ensureQueryData(assignmentsQO);
      void context.queryClient.ensureQueryData(coursesQO);
    }
  },
  component: SchedulePage,
});

function startOfDay(t: number | Date) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

const KIND_LABEL: Record<CalendarEntry["kind"], string> = {
  class: "Class",
  event: "Event",
  planned: "Planned",
  due: "Due",
  canvas: "Canvas event",
};

/** Which calendar an entry belongs to, for the side panel's checkboxes. */
function calendarId(entry: CalendarEntry): string {
  if (entry.kind === "class" || entry.kind === "due") return `class:${entry.courseId ?? "other"}`;
  return entry.kind === "event" ? "events" : entry.kind;
}

/** Calendars turned off in the side panel, saved to the account. */
const HIDDEN_CALENDARS_KEY = "calendar-hidden";

/**
 * The Calendar, in Google Calendar's layout: Day, Week, Month and Schedule,
 * with classes, your events, work you planned, due dates and Canvas events,
 * each a calendar you can turn off on the side.
 */
function SchedulePage() {
  const events = useQuery(eventsQO);
  const assignments = useClassAssignments();
  const courses = useQuery(coursesQO);
  const schedule = useClassSchedule();
  const picks = useCalendarPicks();
  const myEvents = useCalendarEvents();
  const custom = useCustomAssignments();
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const [editing, setEditing] = useState<{
    open: boolean;
    event: CalendarEvent | null;
    day: Date | null;
    minutes: number | null;
  }>({ open: false, event: null, day: null, minutes: null });
  const hiddenPref = useUserPreferenceKey<string[]>(HIDDEN_CALENDARS_KEY, []);
  const hidden = useMemo(
    () => new Set(Array.isArray(hiddenPref.value) ? hiddenPref.value : []),
    [hiddenPref.value],
  );

  const courseList = courses.data ?? [];
  const courseIds = courseList.map((c) => c.id);

  const sources: CalendarSources = useMemo(() => {
    const all = [...(assignments.data ?? [])];
    const byId = new Map(all.map((a) => [a.id, a]));
    const customIds = new Set(custom.list.map((c) => c.id));
    const visible = (id: number) => {
      const a = byId.get(id);
      return !a || isAssignmentVisible(a, completed.has(a.id), false, now);
    };
    const classes: ClassMeeting[] = (schedule.data ?? []).map((s) => {
      const course =
        courseList.find((c) => c.id === s.canvasCourseId) ??
        matchScheduleCourse(
          s.title,
          s.code,
          courseList.map((c) => ({
            ...c,
            display: displayCourseNameForCourse(c.id, c.name, c.course_code),
          })),
        );
      // A lab or discussion found in a syllabus keeps its own name.
      const named = course && s.canvasCourseId === course.id && s.scheduleType === "Lecture";
      return {
        id: s.id,
        title: named
          ? displayCourseNameForCourse(course.id, course.name, course.course_code)
          : s.title,
        days: s.days,
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        location: s.location,
        courseId: course?.id ?? null,
      };
    });
    return {
      classes,
      events: myEvents.list,
      // A deleted task, or finished work, leaves the calendar too.
      picks: picks.list.filter(
        (p) => (p.assignmentId > 0 || customIds.has(p.assignmentId)) && visible(p.assignmentId),
      ),
      due: all.filter(
        (a) =>
          a.due_at &&
          !picks.ids.has(a.id) &&
          isAssignmentVisible(a, completed.has(a.id), false, now) &&
          Date.parse(a.due_at) >= now,
      ),
      canvas: events.data ?? [],
      courseName: (a) => displayCourseName(a.course_name, a.course_code),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assignments.data,
    events.data,
    schedule.data,
    courses.data,
    picks.list,
    picks.ids,
    myEvents.list,
    custom.list,
    completed,
    now,
  ]);

  const loading = events.isLoading || assignments.isLoading || schedule.isLoading;
  const error =
    (events.data ? null : events.error) || (assignments.data ? null : assignments.error);

  const colorOf = useCallback(
    (entry: CalendarEntry) => {
      if (entry.kind === "event") return GOOGLE_COLORS.peacock;
      if (entry.kind === "planned") return GOOGLE_COLORS.blueberry;
      if (entry.kind === "canvas") return GOOGLE_COLORS.graphite;
      return entry.courseId != null
        ? classCalendarColor(entry.courseId, courseIds)
        : GOOGLE_COLORS.basil;
    },
    [courseIds],
  );

  // Each class is its own calendar (its meetings and due dates), then yours.
  const calendars: CalendarSourceInfo[] = [
    ...courseList.map((c) => ({
      id: `class:${c.id}`,
      label: displayCourseNameForCourse(c.id, c.name, c.course_code),
      color: classCalendarColor(c.id, courseIds),
    })),
    ...(sources.classes.some((c) => c.courseId == null)
      ? [{ id: "class:other", label: "Other classes", color: GOOGLE_COLORS.basil }]
      : []),
    { id: "events", label: "My events", color: GOOGLE_COLORS.peacock },
    { id: "planned", label: "Planned work", color: GOOGLE_COLORS.blueberry },
    { id: "canvas", label: "Canvas events", color: GOOGLE_COLORS.graphite },
  ];

  const entriesFor = useCallback(
    (day: Date) => entriesForDay(day, sources).filter((entry) => !hidden.has(calendarId(entry))),
    [sources, hidden],
  );

  return (
    <>
      <GoogleCalendar
        now={now}
        loading={loading}
        error={(error as Error | null) ?? null}
        entriesFor={entriesFor}
        colorOf={colorOf}
        calendars={calendars}
        hidden={hidden}
        onToggleCalendar={(id) => {
          const next = new Set(hidden);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          hiddenPref.set([...next]);
        }}
        onCreate={(day, minutes) =>
          setEditing({ open: true, event: null, day: startOfDay(day), minutes: minutes ?? null })
        }
        renderCard={(entry, close) => (
          <EntryCard
            entry={entry}
            color={colorOf(entry)}
            close={close}
            event={entry.eventId ? myEvents.list.find((e) => e.id === entry.eventId) : undefined}
            picks={picks}
            onEditEvent={(event) => {
              close();
              setEditing({ open: true, event, day: null, minutes: null });
            }}
            onDeleteEvent={(event) => {
              close();
              myEvents.remove(event.id);
              toast("Event deleted", {
                description: event.title,
                action: { label: "Undo", onClick: () => myEvents.add(event) },
              });
            }}
          />
        )}
      />

      <CalendarEventDialog
        open={editing.open}
        onOpenChange={(open) => setEditing((state) => ({ ...state, open }))}
        event={editing.event}
        day={editing.day}
        startMinutes={editing.minutes}
        onSave={({ id, ...event }) => {
          if (id) myEvents.update({ ...event, id });
          else myEvents.add(event);
        }}
        onDelete={myEvents.remove}
      />
    </>
  );
}

/**
 * What opens on an entry, as Google's event card: actions along the top,
 * the color and title, when it is, and the details below.
 */
function EntryCard({
  entry,
  color,
  close,
  event,
  picks,
  onEditEvent,
  onDeleteEvent,
}: {
  entry: CalendarEntry;
  color: string;
  close: () => void;
  event: CalendarEvent | undefined;
  picks: ReturnType<typeof useCalendarPicks>;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (event: CalendarEvent) => void;
}) {
  const when = new Date(entry.start).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const time = entry.allDay ? "All day" : timeRange(entry.start, entry.end);
  const action =
    "grid h-10 w-10 place-items-center rounded-full text-[var(--gc-muted)] transition-colors hover:bg-[var(--gc-hover)]";
  return (
    <div className="pb-5">
      <div className="flex justify-end gap-0.5 px-2 pt-2">
        {entry.kind === "event" && event && (
          <>
            <button
              type="button"
              onClick={() => onEditEvent(event)}
              aria-label="Edit event"
              title="Edit event"
              className={action}
            >
              <Pencil className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteEvent(event)}
              aria-label="Delete event"
              title="Delete event"
              className={action}
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          </>
        )}
        {entry.kind === "class" && (
          <Link
            to="/class-schedule"
            aria-label="Edit in My classes"
            title="Edit in My classes"
            className={action}
          >
            <Pencil className="h-[18px] w-[18px]" />
          </Link>
        )}
        {entry.kind === "planned" && entry.assignmentId != null && (
          <button
            type="button"
            onClick={() => {
              const removed = picks.list.find((p) => p.assignmentId === entry.assignmentId);
              picks.remove(entry.assignmentId!);
              close();
              toast("Removed from your calendar", {
                description: "It's still on To-Do.",
                action: removed
                  ? { label: "Undo", onClick: () => picks.restore(removed) }
                  : undefined,
              });
            }}
            aria-label="Remove from calendar"
            title="Remove from calendar"
            className={action}
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        )}
        <button type="button" onClick={close} aria-label="Close" title="Close" className={action}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-y-3 pr-6">
        <span
          className="mt-2 h-3.5 w-3.5 justify-self-center rounded-[4px]"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <div>
          <p className="break-words text-[22px] leading-7 text-[var(--gc-text)]">{entry.title}</p>
          <p className="mt-1 text-sm text-[var(--gc-text)]">
            {when} · {time}
          </p>
          {event && event.repeat.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[var(--gc-muted)]">
              <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
              {repeatLabel(event.repeat)}
            </p>
          )}
        </div>
        {entry.context && (
          <>
            {entry.kind === "class" || entry.kind === "event" ? (
              <MapPin
                className="h-5 w-5 justify-self-center text-[var(--gc-muted)]"
                aria-hidden="true"
              />
            ) : (
              <BookOpen
                className="h-5 w-5 justify-self-center text-[var(--gc-muted)]"
                aria-hidden="true"
              />
            )}
            <p className="break-words text-sm text-[var(--gc-text)]">{entry.context}</p>
          </>
        )}
        <span aria-hidden="true" className="grid justify-self-center">
          <span className="h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: color }} />
        </span>
        <p className="text-sm text-[var(--gc-muted)]">{KIND_LABEL[entry.kind]}</p>
        {event?.notes && (
          <>
            <AlignLeft
              className="h-5 w-5 justify-self-center text-[var(--gc-muted)]"
              aria-hidden="true"
            />
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--gc-text)]">
              {event.notes}
            </p>
          </>
        )}
        {entry.kind === "planned" && entry.assignmentId != null && (
          <>
            <Clock
              className="mt-2.5 h-5 w-5 justify-self-center text-[var(--gc-muted)]"
              aria-hidden="true"
            />
            <TimePicker
              label={`Time for ${entry.title}`}
              value={`${String(new Date(entry.start).getHours()).padStart(2, "0")}:${String(new Date(entry.start).getMinutes()).padStart(2, "0")}`}
              onChange={(value) => {
                const [h, m] = value.split(":").map(Number);
                if (!Number.isFinite(h) || !Number.isFinite(m)) return;
                const d = new Date(entry.start);
                d.setHours(h, m, 0, 0);
                picks.setTime(entry.assignmentId!, d.toISOString());
              }}
              className="w-48"
            />
          </>
        )}
        {entry.assignmentId != null && (
          <>
            <span aria-hidden="true" />
            <AssignmentDescriptionLink assignmentId={entry.assignmentId} showProgress={false} />
          </>
        )}
      </div>
    </div>
  );
}
