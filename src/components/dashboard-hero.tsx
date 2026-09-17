import { useEffect, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Clock,
  Flame,
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
    if (
      Number.isNaN(start.getTime()) ||
      start.getTime() <= now.getTime() ||
      start.getTime() > endOfWindow
    )
      continue;
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
    if (
      Number.isNaN(start.getTime()) ||
      start.getTime() < now.getTime() ||
      start.getTime() > endOfWindow
    )
      continue;
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

interface Summary {
  today: number;
  tomorrow: number;
  week: number;
  overdue: number;
}

function summarize(
  assignments: AssignmentItem[] | undefined,
  isCompleted: (id: string | number) => boolean,
  now: Date,
): Summary | null {
  if (!assignments) return null;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfToday = startOfDay.getTime() + 24 * 3_600_000;
  const endOfTomorrow = endOfToday + 24 * 3_600_000;
  const inAWeek = startOfDay.getTime() + 7 * 24 * 3_600_000;

  const out: Summary = { today: 0, tomorrow: 0, week: 0, overdue: 0 };

  for (const a of assignments) {
    if (!a.due_at) continue;
    if (isCompleted(a.id)) continue;
    if (a.submission?.submitted_at) continue;
    const due = new Date(a.due_at).getTime();
    if (Number.isNaN(due)) continue;
    if (due < now.getTime()) {
      out.overdue += 1;
      continue;
    }
    if (due < endOfToday) out.today += 1;
    else if (due < endOfTomorrow) out.tomorrow += 1;
    if (due < inAWeek) out.week += 1;
  }

  return out;
}

export function DashboardHero() {
  const [now, setNow] = useState(() => new Date());
  const [firstName, setFirstName] = useState<string | null>(null);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);

  const { data: assignments } = useQuery(assignmentsQO);
  const { data: events } = useQuery(eventsQO);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const meta = data.user?.user_metadata as
        | { full_name?: string; name?: string }
        | undefined;
      const raw = meta?.full_name || meta?.name || data.user?.email || "";
      const first = raw.split(/[\s@.]/)[0];
      setFirstName(first ? first.charAt(0).toUpperCase() + first.slice(1) : null);
    });
    return () => {
      active = false;
    };
  }, []);

  const summary = summarize(assignments, completed.has, now);
  const next = nextUp(events, assignments, now);

  const line = (() => {
    if (!summary) return "Loading your week…";
    if (summary.overdue > 0)
      return `${summary.overdue} overdue · ${summary.week} due this week`;
    if (summary.today > 0)
      return `${summary.today} due today · ${summary.week} due this week`;
    if (summary.tomorrow > 0)
      return `${summary.tomorrow} due tomorrow · ${summary.week} due this week`;
    if (summary.week > 0) return `${summary.week} due this week`;
    return "Nothing due this week — you're clear";
  })();

  return (
    <section className="rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            {summary && summary.overdue > 0 ? (
              <AlertCircle className="size-5 shrink-0 text-muted-foreground" />
            ) : summary && summary.week === 0 ? (
              <Sparkles className="size-5 shrink-0 text-muted-foreground" />
            ) : (
              <Flame className="size-5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{line}</span>
          </h1>
        </div>

        <Link
          to="/focus"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <CalendarDays className="size-3.5" />
          See more
        </Link>
      </div>

      <div
        className={cn(
          "mt-5 flex items-center gap-3 border-t border-border/50 pt-4 text-sm",
          !next && "text-muted-foreground",
        )}
      >
        {next ? (
          <>
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{next.title}</span>
              {next.course ? (
                <span className="text-muted-foreground"> · {next.course}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {untilLabel(next.start, now)}
            </span>
          </>
        ) : (
          <>
            <Calendar className="size-4 shrink-0" />
            <span>Nothing scheduled or due in the next week.</span>
          </>
        )}
      </div>
    </section>
  );
}