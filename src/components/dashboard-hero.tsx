import { useEffect, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  getAllAssignmentsFn,
  getCalendarEventsFn,
  type AssignmentItem,
  type CalendarEventItem,
} from "@/lib/canvas.functions";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import { displayCourseName } from "@/lib/course-display";

const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
  staleTime: 5 * 60_000,
});

const eventsQO = queryOptions({
  queryKey: ["canvas", "calendar"],
  queryFn: () => getCalendarEventsFn(),
  staleTime: 5 * 60_000,
});

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function untilLabel(target: Date, now: Date) {
  const mins = Math.round((target.getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours < 24) return rest ? `in ${hours}h ${rest}m` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

interface NextUpItem {
  start: Date;
  course: string | null;
  kind: "assignment" | "event";
}

function nextUp(
  events: CalendarEventItem[] | undefined,
  assignments: AssignmentItem[] | undefined,
  now: Date,
): NextUpItem | null {
  const items: NextUpItem[] = [];
  const endOfWindow = now.getTime() + 7 * 24 * 60 * 60 * 1000;

  for (const e of events ?? []) {
    if (!e.start_at) continue;
    const start = new Date(e.start_at);
    if (
      Number.isNaN(start.getTime()) ||
      start.getTime() <= now.getTime() ||
      start.getTime() > endOfWindow
    )
      continue;
    items.push({
      start,
      course: e.context_name ? displayCourseName(e.context_name, "") : null,
      kind: "event",
    });
  }

  for (const a of assignments ?? []) {
    if (!a.due_at) continue;
    const start = new Date(a.due_at);
    if (
      Number.isNaN(start.getTime()) ||
      start.getTime() < now.getTime() ||
      start.getTime() > endOfWindow
    )
      continue;
    items.push({
      start,
      course: displayCourseName(a.course_name, a.course_code),
      kind: "assignment",
    });
  }

  items.sort((a, b) => a.start.getTime() - b.start.getTime());
  return items[0] ?? null;
}

function summarize(
  assignments: AssignmentItem[] | undefined,
  isCompleted: (id: string | number) => boolean,
  now: Date,
) {
  if (!assignments) return null;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfToday = startOfDay.getTime() + 24 * 3_600_000;
  const endOfTomorrow = endOfToday + 24 * 3_600_000;
  const inAWeek = startOfDay.getTime() + 7 * 24 * 3_600_000;

  let week = 0;
  let today = 0;
  let tomorrow = 0;
  let overdue = 0;

  for (const a of assignments) {
    if (!a.due_at) continue;
    if (isCompleted(a.id)) continue;
    if (a.submission?.submitted_at) continue;
    const due = new Date(a.due_at).getTime();
    if (due < now.getTime()) {
      if (due >= startOfDay.getTime() - 7 * 24 * 3_600_000) overdue += 1;
      continue;
    }
    if (due <= inAWeek) week += 1;
    if (due < endOfToday) today += 1;
    else if (due < endOfTomorrow) tomorrow += 1;
  }

  const parts: string[] = [];
  parts.push(
    week === 0
      ? "Nothing due this week"
      : `${week} assignment${week === 1 ? "" : "s"} due this week`,
  );
  if (today > 0) parts.push(`${today} today`);
  if (tomorrow > 0) parts.push(`${tomorrow} tomorrow`);
  if (overdue > 0) parts.push(`${overdue} past due`);
  return { text: parts.join(" · "), week, today, tomorrow, overdue };
}

export function DashboardHero() {
  const [now, setNow] = useState(() => new Date());
  const assignments = useQuery(assignmentsQO);
  const events = useQuery(eventsQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const next = nextUp(events.data, assignments.data, now);
  const summary = summarize(assignments.data, completed.has, now);
  const loading = assignments.isLoading || events.isLoading;

  const nextStart = next?.start ?? null;


  return (
    <section className="glass-panel-strong min-w-0 overflow-hidden p-6 sm:p-8 md:p-10">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {now.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>

      <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">
        {greeting(now)}
      </h1>

      <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
        {loading
          ? "Pulling together your day…"
          : (summary?.text ?? "No assignment data yet")}
      </p>

      <div className="mt-7 h-px w-full bg-foreground/[0.06]" />

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Next up
          </p>
          {loading ? (
            <p className="mt-1 text-sm text-muted-foreground">Loading…</p>
          ) : nextStart && next ? (
            <p className="mt-1 truncate text-sm text-foreground sm:text-base">
              {next.kind === "assignment" ? "1 assignment due " : "1 event "}
              {untilLabel(nextStart, now)}
              {next.course ? ` for ${next.course}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing scheduled or due in the next week.
            </p>
          )}
        </div>

        <Link
          to="/focus"
          className="press group inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full border border-foreground/15 px-5 text-sm font-medium transition-colors hover:bg-foreground/[0.06] sm:self-auto"
        >
          See more
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      </div>

    </section>
  );
}
