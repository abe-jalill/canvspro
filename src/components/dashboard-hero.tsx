import { useEffect, useState, type ReactNode } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, CalendarDays, Clock3 } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile";
import { getAllAssignmentsFn, type AssignmentItem } from "@/lib/canvas.functions";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const dueDatesQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: getAllAssignmentsFn,
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
  const inAWeek = startOfDay.getTime() + 7 * 24 * 3_600_000;

  let week = 0;
  let today = 0;
  let overdue = 0;

  for (const assignment of assignments) {
    if (!assignment.due_at || isCompleted(assignment.id)) continue;
    if (assignment.submission?.submitted_at || assignment.submission?.workflow_state === "graded")
      continue;
    const due = new Date(assignment.due_at).getTime();
    if (due < now.getTime()) {
      if (due >= startOfDay.getTime() - 7 * 24 * 3_600_000) overdue += 1;
      continue;
    }
    if (due <= inAWeek) week += 1;
    if (due < endOfToday) today += 1;
  }

  return { week, today, overdue };
}

function StatValue({ loading, children }: { loading: boolean; children: ReactNode }) {
  return loading ? (
    <span className="skeleton-shimmer block h-9 w-10" />
  ) : (
    <span className="text-3xl font-medium tracking-[-0.06em] tabular-nums text-foreground">
      {children}
    </span>
  );
}

export function DashboardHero() {
  const [now, setNow] = useState(() => new Date());
  const [emailPrefix, setEmailPrefix] = useState<string | null>(null);
  const assignments = useQuery(dueDatesQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const { data: profile } = useUserProfile();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email;
      if (email) setEmailPrefix(email.split("@")[0]);
    });
  }, []);

  const displayName =
    profile?.nickname ||
    profile?.firstName ||
    (emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : null);
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const summary = summarize(assignments.data, completed.has, now);
  const loading = assignments.isLoading;
  const todayCount = summary?.today ?? 0;
  const weekCount = summary?.week ?? 0;
  const overdueCount = summary?.overdue ?? 0;

  const message = loading
    ? "Bringing your Canvas schedule into focus."
    : overdueCount > 0
      ? `${overdueCount} past-due item${overdueCount === 1 ? " needs" : "s need"} attention, with ${weekCount} ahead this week.`
      : todayCount > 0
        ? `${todayCount} assignment${todayCount === 1 ? " is" : "s are"} due today. Everything else can wait.`
        : weekCount > 0
          ? `Today is clear. ${weekCount} item${weekCount === 1 ? " is" : "s are"} coming up over the next seven days.`
          : "Your next seven days are clear. Take the win.";

  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-foreground/10 bg-[linear-gradient(135deg,hsl(var(--glass-strong)),hsl(var(--glass)))] shadow-glass-lg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-white/[0.035] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 right-1/4 h-64 w-64 rounded-full bg-blue-400/[0.055] blur-3xl"
      />

      <div className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(21rem,0.75fr)] lg:gap-5 lg:p-6">
        <div className="flex min-h-56 flex-col justify-between px-2 py-3 sm:px-3 sm:py-4 lg:min-h-64 lg:px-5">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{date}</span>
          </div>

          <div className="my-8 max-w-2xl">
            <h1 className="text-balance text-[clamp(2rem,4vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.045em] text-foreground">
              {greeting}
              {displayName ? `, ${displayName}.` : "."}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {message}
            </p>
          </div>

          <Link
            to="/focus"
            className="press group inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.055] px-4 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.09]"
          >
            Open focus view
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="rounded-[1.6rem] border border-foreground/10 bg-background/25 p-2 backdrop-blur-md">
          <Link
            to="/focus"
            search={{ window: "7" }}
            className="press group flex min-h-36 flex-col justify-between rounded-[1.2rem] border border-foreground/10 bg-foreground/[0.045] p-5 transition-colors hover:bg-foreground/[0.075]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Next seven days
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <div className="flex items-end justify-between gap-4">
              <StatValue loading={loading}>{weekCount}</StatValue>
              <span className="max-w-28 pb-1 text-right text-xs leading-snug text-muted-foreground">
                {weekCount === 1 ? "item on your radar" : "items on your radar"}
              </span>
            </div>
          </Link>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link
              to="/focus"
              search={{ window: "1" }}
              className="press flex min-h-28 flex-col justify-between rounded-[1.2rem] border border-foreground/10 bg-foreground/[0.025] p-4 transition-colors hover:bg-foreground/[0.06]"
            >
              <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-2xl font-medium tracking-[-0.05em] tabular-nums">
                  {loading ? "—" : todayCount}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Due today</p>
              </div>
            </Link>
            <Link
              to="/focus"
              className="press flex min-h-28 flex-col justify-between rounded-[1.2rem] border border-foreground/10 bg-foreground/[0.025] p-4 transition-colors hover:bg-foreground/[0.06]"
            >
              <AlertTriangle
                className={cn(
                  "h-4 w-4",
                  overdueCount > 0 ? "text-rose-400" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              <div>
                <p
                  className={cn(
                    "text-2xl font-medium tracking-[-0.05em] tabular-nums",
                    overdueCount > 0 && "text-rose-400",
                  )}
                >
                  {loading ? "—" : overdueCount}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Past due</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
