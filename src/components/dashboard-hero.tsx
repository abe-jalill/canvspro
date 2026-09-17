import { useEffect, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Calendar, CalendarDays, Clock, Flame, Sparkles } from "lucide-react";
import {
  getAllAssignmentsFn,
  getCalendarEventsFn,
  type AssignmentItem,
  type CalendarEventItem,
} from "@/lib/canvas.functions";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
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

  const summary = summarize(assignments.data, completed.has, now);
  const loading = assignments.isLoading || events.isLoading;

  const todayCount = summary?.today ?? 0;
  const weekCount = summary?.week ?? 0;
  const overdueCount = summary?.overdue ?? 0;

  return (
    <div className="mb-6 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
          {userName ? `${userName} Returns!` : "Abrahim Returns!"}
        </h1>
        <p className="mt-1.5 text-sm font-normal text-muted-foreground sm:text-base">
          {loading ? (
            "Syncing your Canvas schedule…"
          ) : todayCount > 0 ? (
            <>
              You have{" "}
              <span className="text-foreground">
                {todayCount} assignment{todayCount === 1 ? "" : "s"}
              </span>{" "}
              due today. Let&apos;s knock them out.
            </>
          ) : weekCount > 0 ? (
            <>
              You&apos;re clear for today.{" "}
              <span className="text-foreground">
                {weekCount} item{weekCount === 1 ? "" : "s"}
              </span>{" "}
              coming up over the next 7 days.
            </>
          ) : (
            "All caught up! Nothing due over the next 7 days."
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/focus"
          className="glass-inset glass-hover flex items-center gap-3 rounded-2xl px-3.5 py-2 transition-all border border-white/5 hover:border-white/12"
        >
          <span className="text-2xl font-normal text-foreground tracking-tight tabular-nums">{todayCount}</span>
          <span className="text-xs font-normal text-muted-foreground leading-tight">
            Due
            <br />
            Today
          </span>
        </Link>

        <div className="h-6 w-px bg-white/10 hidden sm:block" />

        <Link
          to="/focus"
          className="glass-inset glass-hover flex items-center gap-3 rounded-2xl px-3.5 py-2 transition-all border border-white/5 hover:border-white/12"
        >
          <span className="text-2xl font-normal text-foreground tracking-tight tabular-nums">{weekCount}</span>
          <span className="text-xs font-normal text-muted-foreground leading-tight">
            This
            <br />
            Week
          </span>
        </Link>

        <div className="h-6 w-px bg-white/10 hidden sm:block" />

        <Link
          to="/focus"
          className="glass-inset glass-hover flex items-center gap-3 rounded-2xl px-3.5 py-2 transition-all border border-white/5 hover:border-white/12"
        >
          <span
            className={cn(
              "text-2xl font-normal tracking-tight tabular-nums",
              overdueCount > 0 ? "text-rose-400" : "text-foreground",
            )}
          >
            {overdueCount}
          </span>
          <span className="text-xs font-normal text-muted-foreground leading-tight">
            Past
            <br />
            Due
          </span>
        </Link>
      </div>
    </div>
  );
}
