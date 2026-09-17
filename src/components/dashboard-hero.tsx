import { useEffect, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import {
  getAllAssignmentsFn,
  getCalendarEventsFn,
  type AssignmentItem,
  type CalendarEventItem,
} from "@/lib/canvas.functions";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import { displayCourseName } from "@/lib/course-display";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  if (mins <= 0) return "Due right now";
  if (mins < 60) return `Due in ${mins}m`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours < 24) return rest ? `Due in ${hours}h ${rest}m` : `Due in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

interface NextUpItem {
  start: Date;
  title: string;
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
    if (Number.isNaN(start.getTime()) || start.getTime() <= now.getTime() || start.getTime() > endOfWindow) continue;
    items.push({
      start,
      title: e.title || "Event",
      course: e.context_name ? displayCourseName(e.context_name, "") : null,
      kind: "event",
    });
  }

  for (const a of assignments ?? []) {
    if (!a.due_at) continue;
    const start = new Date(a.due_at);
    if (Number.isNaN(start.getTime()) || start.getTime() < now.getTime() || start.getTime() > endOfWindow) continue;
    items.push({
      start,
      title: a.name,
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

  return { week, today, tomorrow, overdue };
}

export function DashboardHero() {
  const [now, setNow] = useState(() => new Date());
  const [userName, setUserName] = useState<string | null>(null);
  const assignments = useQuery(assignmentsQO);
  const events = useQuery(eventsQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        const meta = data.user.user_metadata;
        const name = meta?.full_name || meta?.name || data.user.email?.split("@")[0];
        if (name) setUserName(name.charAt(0).toUpperCase() + name.slice(1));
      }
    });
  }, []);

  const next = nextUp(events.data, assignments.data, now);
  const summary = summarize(assignments.data, completed.has, now);
  const loading = assignments.isLoading || events.isLoading;

  const todayCount = summary?.today ?? 0;
  const weekCount = summary?.week ?? 0;
  const overdueCount = summary?.overdue ?? 0;

  return (
    <section className="glass-panel-strong relative overflow-hidden rounded-3xl border border-foreground/10 p-5 sm:p-7 md:p-8 shadow-glass-lg transition-all">
      {/* Subtle ambient gradient lighting */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

      {/* Header Bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live Sync
          </span>
        </div>
      </div>

      {/* Greeting & Headline */}
      <div className="relative mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
          {greeting(now)}
          {userName ? `, ${userName}` : ""}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
          {loading ? (
            "Syncing your Canvas schedule and scores…"
          ) : todayCount > 0 ? (
            <>
              You have{" "}
              <span className="font-semibold text-foreground">
                {todayCount} assignment{todayCount === 1 ? "" : "s"}
              </span>{" "}
              due today. Let&apos;s knock them out.
            </>
          ) : weekCount > 0 ? (
            <>
              You&apos;re clear for today.{" "}
              <span className="font-semibold text-foreground">
                {weekCount} item{weekCount === 1 ? "" : "s"}
              </span>{" "}
              coming up over the next 7 days.
            </>
          ) : (
            "All caught up! Nothing due over the next 7 days."
          )}
        </p>
      </div>

      {/* Key Metric Stats Cards */}
      <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Due Today */}
        <div className="glass-inset flex flex-col justify-between p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Due Today</span>
            <Clock className={cn("h-4 w-4", todayCount > 0 ? "text-amber-400" : "text-muted-foreground")} />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {loading ? "…" : todayCount}
            </span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {todayCount > 0 ? "Urgent attention" : "Zero due today"}
            </p>
          </div>
        </div>

        {/* Due This Week */}
        <div className="glass-inset flex flex-col justify-between p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">This Week</span>
            <CalendarDays className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {loading ? "…" : weekCount}
            </span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {weekCount === 1 ? "1 assignment" : `${weekCount} assignments`}
            </p>
          </div>
        </div>

        {/* Next Deadline */}
        <div className="glass-inset col-span-2 flex flex-col justify-between p-3.5 sm:col-span-2 sm:p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Next Up</span>
            <Flame className="h-4 w-4 text-orange-400" />
          </div>
          <div className="mt-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Finding next item…</p>
            ) : next ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-400">
                    {untilLabel(next.start, now)}
                  </span>
                  {next.course && (
                    <span className="truncate text-xs font-medium text-muted-foreground">{next.course}</span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-foreground sm:text-base">{next.title}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-foreground">Nothing scheduled</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Enjoy your free time</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer / Quick Actions Bar */}
      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {overdueCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-rose-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {overdueCount} past due assignment{overdueCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />0 overdue assignments
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/focus"
            className="press inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-foreground/15 px-3 text-xs font-medium text-foreground transition-colors hover:bg-foreground/10"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Focus View
          </Link>
          <Link
            to="/assignments"
            className="press inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-foreground px-3.5 text-xs font-semibold text-background transition-colors hover:opacity-90"
          >
            All Assignments
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
