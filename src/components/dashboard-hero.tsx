import { useEffect, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useUserProfile } from "@/lib/user-profile";
import { getDueDatesFn, type DueDateItem } from "@/lib/canvas.functions";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Counts only. The greeting card runs on the FREE dashboard, so it must never
// pull the full Pro dataset into a free user's browser.
const dueDatesQO = queryOptions({
  queryKey: ["canvas", "duedates"],
  queryFn: () => getDueDatesFn(),
  staleTime: 5 * 60_000,
});

function summarize(
  assignments: DueDateItem[] | undefined,
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
    if (a.submitted) continue;
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
  const [emailPrefix, setEmailPrefix] = useState<string | null>(null);
  const assignments = useQuery(dueDatesQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const { data: profile } = useUserProfile();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email;
      if (email) setEmailPrefix(email.split("@")[0]);
    });
  }, []);

  const displayName =
    profile?.nickname ||
    profile?.firstName ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    (emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : null);

  const summary = summarize(assignments.data, completed.has, now);
  const loading = assignments.isLoading;

  const todayCount = summary?.today ?? 0;
  const weekCount = summary?.week ?? 0;
  const overdueCount = summary?.overdue ?? 0;

  return (
    <div className="glass-panel-strong mb-6 overflow-hidden rounded-3xl p-5 sm:p-6 shadow-glass">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-normal tracking-tight text-foreground sm:text-2xl">
            {displayName ? `${displayName} Returns!` : "Welcome back!"}
          </h1>
          <p className="mt-1 text-xs font-normal text-muted-foreground sm:text-sm">
            {loading ? (
              "Syncing your Canvas schedule…"
            ) : todayCount > 0 ? (
              <>
                You have{" "}
                <span className="text-foreground font-normal">
                  {todayCount} assignment{todayCount === 1 ? "" : "s"}
                </span>{" "}
                due today. Let&apos;s knock them out.
              </>
            ) : weekCount > 0 ? (
              <>
                You&apos;re clear for today.{" "}
                <span className="text-foreground font-normal">
                  {weekCount} item{weekCount === 1 ? "" : "s"}
                </span>{" "}
                coming up over the next 7 days.
              </>
            ) : (
              "All caught up! Nothing due over the next 7 days."
            )}
          </p>
        </div>

        {/* 3 stats in unified segmented card pill separated by vertical lines */}
        <div className="glass-inset flex shrink-0 items-stretch divide-x divide-white/10 rounded-2xl border border-white/5 overflow-hidden">
          <Link
            to="/focus"
            search={{ window: "1" }}
            className="glass-hover flex items-center gap-2.5 px-4 py-2.5 transition-colors"
            title="Assignments due today"
          >
            <span className="text-xl font-normal text-foreground tracking-tight tabular-nums sm:text-2xl">
              {todayCount}
            </span>
            <span className="text-[11px] font-normal text-muted-foreground leading-tight sm:text-xs">
              Due
              <br className="hidden sm:inline" /> Today
            </span>
          </Link>

          <Link
            to="/focus"
            search={{ window: "7" }}
            className="glass-hover flex items-center gap-2.5 px-4 py-2.5 transition-colors"
            title="Assignments due within one week"
          >
            <span className="text-xl font-normal text-foreground tracking-tight tabular-nums sm:text-2xl">
              {weekCount}
            </span>
            <span className="text-[11px] font-normal text-muted-foreground leading-tight sm:text-xs">
              One
              <br className="hidden sm:inline" /> Week
            </span>
          </Link>

          <Link
            to="/focus"
            className="glass-hover flex items-center gap-2.5 px-4 py-2.5 transition-colors"
            title="Past due assignments"
          >
            <span
              className={cn(
                "text-xl font-normal tracking-tight tabular-nums sm:text-2xl",
                overdueCount > 0 ? "text-rose-400" : "text-foreground",
              )}
            >
              {overdueCount}
            </span>
            <span className="text-[11px] font-normal text-muted-foreground leading-tight sm:text-xs">
              Past
              <br className="hidden sm:inline" /> Due
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
