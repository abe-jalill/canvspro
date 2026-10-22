import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Pencil, Sun, X } from "lucide-react";
import { GlassCard, ErrorState } from "@/components/glass-card";
import { displayCourseName, displayCourseNameForCourse } from "@/lib/course-display";
import { PageTabs } from "@/components/page-tabs";
import { CALENDAR_TABS } from "@/lib/page-tab-sets";
import { WorkloadHeatmap } from "@/components/workload-heatmap";
import { isAssignmentVisible } from "@/lib/assignment-window";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import {
  calendarQueryOptions as eventsQO,
  assignmentsQueryOptions as assignmentsQO,
  coursesQueryOptions as coursesQO,
} from "@/lib/canvas.queries";
import { SkeletonBlock, WorkloadHeatmapSkeleton } from "@/components/skeletons/dashboard-skeletons";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { useCalendarPicks } from "@/lib/calendar-picks";
import { repeatLabel, type CalendarEvent } from "@/lib/calendar-events";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import {
  entriesForDay,
  entryTimeLabel,
  type CalendarEntry,
  type CalendarSources,
  type ClassMeeting,
} from "@/lib/calendar-agenda";
import { useClassSchedule } from "@/lib/user-class-schedule";
import { matchScheduleCourse } from "@/lib/class-schedule";
import { classColor } from "@/lib/class-color";
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

const DAY_MS = 86_400_000;
/** Earlier weeks show your classes and events (finished due dates are on Completed). */
const WEEKS_BACK = 12;
/** "Upcoming" looks this many days ahead. */
const UPCOMING_DAYS = 30;

function startOfDay(t: number | Date) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Monday of the week `offset` weeks from this one. */
function weekStart(today: Date, offset: number) {
  return addDays(today, -((today.getDay() + 6) % 7) + offset * 7);
}

function dayTitle(day: Date, today: Date) {
  const diff = Math.round((day.getTime() - today.getTime()) / DAY_MS);
  const date = day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return diff === 0 ? `Today · ${date}` : diff === 1 ? `Tomorrow · ${date}` : date;
}

const KIND_LABEL: Record<CalendarEntry["kind"], string> = {
  class: "Class",
  event: "Event",
  planned: "Planned",
  due: "Due",
  canvas: "Canvas event",
};

/**
 * The Calendar: a week to pick a day from, then that day in time order —
 * classes, your events, work you planned, and what's due. "Upcoming" lists
 * the next month without the everyday classes.
 */
function SchedulePage() {
  const events = useQuery(eventsQO);
  const assignments = useQuery(assignmentsQO);
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
  const today = startOfDay(now);
  const [weekOffset, setWeekOffset] = useState(0);
  /** Which way the weeks last moved, so the new week slides in from that side. */
  const [weekDirection, setWeekDirection] = useState<1 | -1>(1);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<Date | null>(today);
  const [editing, setEditing] = useState<{ open: boolean; event: CalendarEvent | null }>({
    open: false,
    event: null,
  });

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

  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(today, weekOffset), i));
  const dayEntries = selected ? entriesForDay(selected, sources) : [];
  const upcoming = selected
    ? []
    : Array.from({ length: UPCOMING_DAYS }, (_, i) => addDays(today, i))
        .map((day) => ({ day, entries: entriesForDay(day, sources, { classes: false }) }))
        .filter((group) => group.entries.length > 0);

  const loading = events.isLoading || assignments.isLoading || schedule.isLoading;
  const error =
    (events.data ? null : events.error) || (assignments.data ? null : assignments.error);
  const monthLabel = week[3].toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function changeWeek(by: number) {
    const next = Math.max(-WEEKS_BACK, weekOffset + by);
    if (next === weekOffset) return;
    setWeekDirection(by > 0 ? 1 : -1);
    setWeekOffset(next);
    if (selected) setSelected(next === 0 && by < 0 ? today : weekStart(today, next));
  }

  const colorFor = (entry: CalendarEntry) =>
    entry.kind === "event" || entry.kind === "planned"
      ? "hsl(var(--primary))"
      : entry.kind === "canvas"
        ? "hsl(35 80% 60%)"
        : entry.courseId != null
          ? classColor(entry.courseId, courseIds)
          : "hsl(var(--muted-foreground))";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">
      <PageTabs tabs={CALENDAR_TABS} label="Calendar sections" />
      <header className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {monthLabel}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Calendar</h1>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ open: true, event: null })}
          disabled={!myEvents.ready}
          className="press inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Add event
        </button>
      </header>

      {/* The week: pick a day. A dot marks days with something besides class. */}
      <section className="glass-panel-strong rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-semibold tracking-tight">
            {week[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
            {week[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => changeWeek(-1)}
              disabled={weekOffset <= -WEEKS_BACK}
              aria-label="Previous week"
              className="press grid h-9 w-9 place-items-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeWeek(1)}
              aria-label="Next week"
              className="press grid h-9 w-9 place-items-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Swipe (or drag) the week sideways for the next or previous one. */}
        <div
          key={weekOffset}
          className={cn(
            "mt-3 grid touch-pan-y select-none grid-cols-7 gap-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
            weekDirection > 0
              ? "motion-safe:slide-in-from-right-8"
              : "motion-safe:slide-in-from-left-8",
          )}
          onPointerDown={(e) => {
            swipeStart.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const start = swipeStart.current;
            swipeStart.current = null;
            if (!start) return;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) changeWeek(dx < 0 ? 1 : -1);
          }}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
        >
          {week.map((day) => {
            const isToday = day.getTime() === today.getTime();
            const isSelected = selected?.getTime() === day.getTime();
            const busy = entriesForDay(day, sources, { classes: false }).length > 0;
            const hasClass = sources.classes.some((c) =>
              c.days.some((d) => ({ M: 1, T: 2, W: 3, R: 4, F: 5 })[d] === day.getDay()),
            );
            const past = day < today;
            return (
              <button
                key={day.getTime()}
                type="button"
                onClick={() => setSelected(day)}
                aria-pressed={isSelected}
                aria-label={day.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2 transition-colors hover:bg-foreground/5",
                  past && "opacity-45",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase",
                    isToday ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {day.toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full text-sm font-semibold tabular-nums",
                    isSelected
                      ? "bg-foreground text-background"
                      : isToday
                        ? "border border-primary/60 text-primary"
                        : "text-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                  {hasClass && <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />}
                  {busy && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          {[
            {
              label: "Today",
              on: weekOffset === 0 && selected?.getTime() === today.getTime(),
              go: () => {
                setWeekOffset(0);
                setSelected(today);
              },
            },
            { label: "Upcoming", on: selected == null, go: () => setSelected(null) },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.go}
              aria-pressed={chip.on}
              className={cn(
                "min-h-9 rounded-full px-3.5 text-xs font-medium transition-colors",
                chip.on
                  ? "bg-foreground text-background"
                  : "bg-foreground/[0.06] text-muted-foreground hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Loading your calendar">
          <SkeletonBlock className="h-4 w-48" />
          <SkeletonBlock className="h-16 w-full" />
          <SkeletonBlock className="h-16 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : selected ? (
        <DaySection
          title={dayTitle(selected, today)}
          entries={dayEntries}
          colorFor={colorFor}
          now={now}
          onEditEvent={(id) =>
            setEditing({ open: true, event: myEvents.list.find((e) => e.id === id) ?? null })
          }
          onAdd={() => setEditing({ open: true, event: null })}
          picks={picks}
          events={myEvents.list}
        />
      ) : upcoming.length === 0 ? (
        <p className="px-1 py-10 text-center text-sm text-muted-foreground">
          Nothing coming up in the next {UPCOMING_DAYS} days besides class.
        </p>
      ) : (
        <div className="space-y-6">
          {upcoming.map((group) => (
            <DaySection
              key={group.day.getTime()}
              title={dayTitle(group.day, today)}
              entries={group.entries}
              colorFor={colorFor}
              now={now}
              onEditEvent={(id) =>
                setEditing({ open: true, event: myEvents.list.find((e) => e.id === id) ?? null })
              }
              picks={picks}
              events={myEvents.list}
            />
          ))}
        </div>
      )}

      <GlassCard title="Workload" subtitle="Remaining effort by week">
        {assignments.isLoading ? (
          <WorkloadHeatmapSkeleton />
        ) : (
          <WorkloadHeatmap
            assignments={(assignments.data ?? []).filter((assignment) =>
              isAssignmentVisible(assignment, completed.has(assignment.id), false, now),
            )}
          />
        )}
      </GlassCard>

      <CalendarEventDialog
        open={editing.open}
        onOpenChange={(open) => setEditing((state) => ({ ...state, open }))}
        event={editing.event}
        day={selected}
        onSave={({ id, ...event }) => {
          if (id) myEvents.update({ ...event, id });
          else myEvents.add(event);
        }}
        onDelete={myEvents.remove}
      />
    </div>
  );
}

/** One day: a time column, a colored bar, what it is, and its actions. */
function DaySection({
  title,
  entries,
  colorFor,
  now,
  onEditEvent,
  onAdd,
  picks,
  events,
}: {
  title: string;
  entries: CalendarEntry[];
  colorFor: (entry: CalendarEntry) => string;
  now: number;
  onEditEvent: (id: string) => void;
  onAdd?: () => void;
  picks: ReturnType<typeof useCalendarPicks>;
  events: CalendarEvent[];
}) {
  return (
    <section>
      <h2 className="flex items-baseline justify-between px-1 text-[15px] font-semibold tracking-[-0.01em]">
        {title}
        <span className="text-xs font-normal tabular-nums text-muted-foreground">
          {entries.length === 0
            ? ""
            : entries.length === 1
              ? "1 thing"
              : `${entries.length} things`}
        </span>
      </h2>
      <ul className="glass-panel mt-2 divide-y divide-foreground/[0.07] rounded-2xl border border-foreground/10 px-4">
        {entries.length === 0 && (
          <li className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
            <Sun className="h-4 w-4" aria-hidden="true" />
            Nothing on this day.
            {onAdd && (
              <button
                type="button"
                onClick={onAdd}
                className="ml-auto text-xs font-medium text-primary hover:opacity-80"
              >
                Add event
              </button>
            )}
          </li>
        )}
        {entries.map((entry) => {
          const over = !entry.allDay && (entry.end ?? entry.start) < now;
          const event = entry.eventId ? events.find((e) => e.id === entry.eventId) : undefined;
          const [startLabel, endLabel] = entryTimeLabel(entry).split(" – ");
          const line = [
            KIND_LABEL[entry.kind],
            entry.context,
            event && event.repeat.length > 0 ? repeatLabel(event.repeat) : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={entry.key}
              className={cn(
                "grid grid-cols-[4.75rem_3px_minmax(0,1fr)_auto] items-start gap-3 py-3.5",
                over && "opacity-55",
              )}
            >
              <div className="pt-0.5 text-right tabular-nums">
                <p className="text-sm font-medium">{startLabel}</p>
                {endLabel && <p className="text-xs text-muted-foreground">{endLabel}</p>}
              </div>
              <span
                className="mt-1 h-[calc(100%-0.5rem)] min-h-8 w-[3px] rounded-full"
                style={{ backgroundColor: colorFor(entry) }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="break-words text-[15px] font-medium leading-snug">{entry.title}</p>
                <p className="mt-0.5 break-words text-xs text-muted-foreground">{line}</p>
                {event?.notes && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/70">
                    {event.notes}
                  </p>
                )}
                {entry.assignmentId != null && (
                  <AssignmentDescriptionLink
                    assignmentId={entry.assignmentId}
                    className="mt-1"
                    showProgress={false}
                  />
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {entry.kind === "event" && entry.eventId && (
                  <button
                    type="button"
                    onClick={() => onEditEvent(entry.eventId!)}
                    aria-label={`Edit ${entry.title}`}
                    className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {entry.kind === "class" && (
                  <Link
                    to="/class-schedule"
                    aria-label={`Edit ${entry.title} in My classes`}
                    className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                )}
                {entry.kind === "planned" && entry.assignmentId != null && (
                  <>
                    <input
                      type="time"
                      aria-label={`Time for ${entry.title}`}
                      value={`${String(new Date(entry.start).getHours()).padStart(2, "0")}:${String(new Date(entry.start).getMinutes()).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        if (!Number.isFinite(h) || !Number.isFinite(m)) return;
                        const d = new Date(entry.start);
                        d.setHours(h, m, 0, 0);
                        picks.setTime(entry.assignmentId!, d.toISOString());
                      }}
                      className="w-[6.5rem] rounded-lg border border-foreground/10 bg-transparent px-2 py-1 text-xs tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const removed = picks.list.find(
                          (p) => p.assignmentId === entry.assignmentId,
                        );
                        picks.remove(entry.assignmentId!);
                        toast("Removed from your calendar", {
                          description: "It's still on To-Do.",
                          action: removed
                            ? { label: "Undo", onClick: () => picks.restore(removed) }
                            : undefined,
                        });
                      }}
                      aria-label={`Remove ${entry.title} from calendar`}
                      className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
