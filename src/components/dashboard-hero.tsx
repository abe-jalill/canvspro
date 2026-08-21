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

function nextEvent(events: CalendarEventItem[] | undefined, now: Date) {
  if (!events) return null;
  const upcoming = events
    .filter((e) => e.start_at && new Date(e.start_at).getTime() > now.getTime())
    .sort(
      (a, b) =>
        new Date(a.start_at as string).getTime() -
        new Date(b.start_at as string).getTime(),
    );
  return upcoming[0] ?? null;
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
  return { text: parts.join(", "), week, today, tomorrow, overdue };
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

  const next = nextEvent(events.data, now);
  const summary = summarize(assignments.data, completed.has, now);
  const loading = assignments.isLoading || events.isLoading;

  const nextStart = next?.start_at ? new Date(next.start_at) : null;

  return (
    <section className="glass-panel-strong min-w-0 overflow-hidden p-5 sm:p-7 md:p-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {now.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
        {greeting(now)}
      </h1>

      <p className="mt-3 max-w-2xl text-sm text-foreground/85 sm:text-base">
        {loading
          ? "Pulling together your day…"
          : (summary?.text ?? "No assignment data yet")}
        {summary && summary.week === 0 && summary.overdue === 0 && " — enjoy it."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="glass-inset min-w-0 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Next up
          </p>
          {loading ? (
            <p className="mt-1.5 text-sm text-muted-foreground">Loading…</p>
          ) : nextStart && next ? (
            <>
              <p className="mt-1.5 truncate text-base font-semibold tracking-tight">
                {next.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {untilLabel(nextStart, now)} ·{" "}
                {nextStart.toLocaleString(undefined, {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {next.context_name
                  ? ` · ${displayCourseName(next.context_name, "")}`
                  : ""}
                {next.location_name ? ` · ${next.location_name}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">
              No scheduled classes or events in the next two weeks.
            </p>
          )}
        </div>

        <Link
          to="/focus"
          className="glass-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
        >
          Open Focus
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
