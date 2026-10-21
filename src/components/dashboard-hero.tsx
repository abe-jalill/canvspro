import { dueTodayClass } from "@/lib/assignment-due";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Play, Undo2 } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { isDueThisWeek, isInFocusWindow } from "@/lib/focus-window";
import {
  customToAssignmentItem,
  isCustomAssignmentId,
  useCustomAssignments,
} from "@/lib/custom-assignments";
import { notYetOpen } from "@/lib/assignment-availability";
import { useAssignmentMeta } from "@/hooks/use-assignment-meta";
import { isAssignmentComplete, isAssignmentVisible } from "@/lib/assignment-window";
import { selectNextUp } from "@/lib/assignment-workload";
import { displayCourseName } from "@/lib/course-display";
import { defaultEstimateMinutes } from "@/lib/get-it-done";
import { getCountdown, urgencyTextClass } from "@/lib/countdown";
import { classColor } from "@/lib/class-color";
import { weekProgress, type DayProgress } from "@/lib/week-progress";
import { DashboardPomodoro } from "@/components/dashboard-pomodoro";
import { formatMinutes } from "@/lib/format-minutes";

import {
  assignmentsQueryOptions as dueDatesQO,
  coursesQueryOptions as coursesQO,
} from "@/lib/canvas.queries";

function summarize(
  assignments: AssignmentItem[],
  isCompleted: (id: string | number) => boolean,
  now: number,
) {
  let week = 0;
  let today = 0;
  let overdue = 0;
  for (const assignment of assignments) {
    const completed = isCompleted(assignment.id);
    if (isInFocusWindow(assignment, "overdue", now, completed)) overdue += 1;
    // The same seven days as the circles below.
    if (isAssignmentVisible(assignment, completed, false, now) && isDueThisWeek(assignment, now))
      week += 1;
    if (isInFocusWindow(assignment, "1", now, completed)) today += 1;
  }
  return { week, today, overdue };
}

/**
 * Today's top, like the iPhone app: the date and greeting (the name in the
 * palette color) with one line on the week and the next seven days as
 * circles; then Next up, the page's one lit card, and a catch-up row only
 * when something is past due. Until everything has loaded it's placeholders
 * only, never counts worked out from half the data.
 */
export function DashboardHero() {
  const [now, setNow] = useState(() => Date.now());
  const [emailPrefix, setEmailPrefix] = useState<string | null>(null);
  const assignments = useQuery(dueDatesQO);
  const courses = useQuery(coursesQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const custom = useCustomAssignments();
  const meta = useAssignmentMeta();
  const profile = useUserProfile();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email;
      if (email) setEmailPrefix(email.split("@")[0]);
    });
  }, []);

  const loading =
    assignments.isLoading ||
    courses.isLoading ||
    completed.isLoading ||
    custom.isLoading ||
    meta.isLoading ||
    profile.isLoading;
  if (loading) return <DashboardHeroSkeleton />;

  const displayName =
    profile.data?.nickname ||
    profile.data?.firstName ||
    (emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : null);
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const date = new Date(now).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Work Canvas hasn't opened yet stays off the dashboard.
  const courseById = new Map((courses.data ?? []).map((course) => [course.id, course]));
  const allAssignments = [
    ...(assignments.data ?? []).filter((a) => !notYetOpen(a, now)),
    ...custom.list.map((item) => customToAssignmentItem(item, courseById.get(item.course_id))),
  ];
  const isDone = (a: AssignmentItem) => isAssignmentComplete(a, completed.has(a.id));
  const { today, week, overdue } = summarize(allAssignments, completed.has, now);
  const days = weekProgress(
    allAssignments,
    isDone,
    (a) => isAssignmentVisible(a, completed.has(a.id), false, now),
    now,
  );
  const nextUp = selectNextUp(
    allAssignments.filter((a) => !isDone(a)),
    now,
  );
  const courseIds = (courses.data ?? []).map((course) => course.id);

  // A failed refresh keeps showing what loaded before; only nothing at all is an error.
  const failed = assignments.isError && !assignments.data;
  const message = failed
    ? "Couldn't load your assignments. Refresh Canvas to try again."
    : week === 0
      ? overdue > 0
        ? "Nothing else due in the next seven days."
        : "You're clear for the next seven days."
      : `${today > 0 ? `${today} due in 24 hours` : "Nothing due today"} · ${week} this week`;

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)] lg:items-start lg:gap-6">
      <div className="dashboard-today__header relative min-w-0 px-1 pt-1">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{date}</p>
            {/* Wraps for a long name instead of shrinking. */}
            <h1 className="mt-1 text-balance text-[clamp(1.9rem,3.6vw,2.9rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground">
              {greeting}
              {displayName && (
                <>
                  , <span className="text-primary">{displayName}</span>
                </>
              )}
            </h1>
          </div>
          <DashboardPomodoro />
        </div>
        <p className="relative mt-2 text-base tabular-nums text-muted-foreground">{message}</p>
        {!failed && days.some((day) => day.total > 0) && <WeekCircles days={days} />}
      </div>

      {!failed && (
        <div className="space-y-3">
          <NextUpCard
            assignment={nextUp}
            progress={
              nextUp
                ? (meta.data?.find((row) => row.assignmentId === nextUp.id)?.progressPercent ?? 0)
                : 0
            }
            minutes={
              nextUp
                ? (meta.data?.find((row) => row.assignmentId === nextUp.id)?.estimatedMinutes ??
                  defaultEstimateMinutes(nextUp))
                : 0
            }
            color={nextUp ? classColor(nextUp.course_id, courseIds) : undefined}
            now={now}
          />
          {overdue > 0 && (
            <Link
              to="/focus"
              preload="intent"
              className="glass-panel group flex min-h-14 items-center gap-3 rounded-2xl border border-foreground/10 px-4 transition-colors hover:border-foreground/25"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-400/15 text-rose-400">
                <Undo2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="flex-1 text-sm font-medium tabular-nums">{overdue} to catch up</span>
              <ChevronRight
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The next seven days, today first: each day with work shows how many are left
 * inside a ring that fills as they get done, and turns solid with a check when
 * it's all done. A day with nothing due is a dot. The whole row opens To-Do.
 */
function WeekCircles({ days }: { days: DayProgress[] }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), 150);
    return () => window.clearTimeout(id);
  }, []);
  const done = days.reduce((sum, day) => sum + day.done, 0);
  const total = days.reduce((sum, day) => sum + day.total, 0);
  const todayStart = days[0]?.date;

  return (
    <Link
      to="/focus"
      preload="intent"
      aria-label={`Next seven days, ${done} of ${total} done`}
      className="relative mt-6 grid max-w-xl grid-cols-7 rounded-2xl py-1 transition-opacity hover:opacity-90"
    >
      {days.map((day) => {
        const isToday = day.date === todayStart;
        const left = day.total - day.done;
        const progress = day.total === 0 ? 0 : day.done / day.total;
        return (
          <span key={day.date} className="flex flex-col items-center gap-2" aria-hidden="true">
            <span
              className={cn(
                "text-[11px]",
                isToday ? "font-semibold text-primary" : "font-medium text-muted-foreground/70",
              )}
            >
              {new Date(day.date).toLocaleDateString(undefined, { weekday: "narrow" })}
            </span>
            <span className="relative grid h-8 w-8 place-items-center">
              {day.total === 0 ? (
                <span className="h-1 w-1 rounded-full bg-foreground/15" />
              ) : left === 0 ? (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              ) : (
                <>
                  <svg
                    viewBox="0 0 32 32"
                    className="absolute inset-0 h-8 w-8 -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="text-foreground/10"
                    />
                    {/* No arc at all until something is done (a round cap would draw a dot). */}
                    {progress > 0 && (
                      <circle
                        cx="16"
                        cy="16"
                        r="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        pathLength={100}
                        strokeDasharray={`${(shown ? progress : 0) * 100} 100`}
                        className="text-primary transition-[stroke-dasharray] duration-500 ease-out motion-reduce:transition-none"
                      />
                    )}
                  </svg>
                  <span className="relative text-xs font-semibold tabular-nums text-foreground">
                    {left}
                  </span>
                </>
              )}
            </span>
          </span>
        );
      })}
    </Link>
  );
}

/** The one suggestion (what Get It Done was): open it, or Start to study it. */
function NextUpCard({
  assignment,
  progress,
  minutes,
  color,
  now,
}: {
  assignment: AssignmentItem | null;
  progress: number;
  minutes: number;
  color?: string;
  now: number;
}) {
  if (!assignment) {
    return (
      <div className="dashboard-hero__stat-card relative rounded-[1.6rem] p-5">
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Next up
        </p>
        <p className="relative mt-2 text-base">Nothing due in the next seven days.</p>
      </div>
    );
  }
  const cd = getCountdown(assignment.due_at, { completed: false });
  const detail = [
    displayCourseName(assignment.course_name, assignment.course_code),
    assignment.points_possible != null ? `${assignment.points_possible} pts` : null,
    formatMinutes(minutes),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "dashboard-hero__stat-card relative rounded-[1.6rem] p-5",
        dueTodayClass(assignment.due_at, false, now),
      )}
    >
      {/* Your own tasks aren't on a class page; Assignments has them. */}
      <Link
        {...(isCustomAssignmentId(assignment.id)
          ? { to: "/assignments", search: { assignment: String(assignment.id) } }
          : {
              to: "/courses/$courseId",
              params: { courseId: String(assignment.course_id) },
              search: { assignment: String(assignment.id) },
            })}
        preload="intent"
        className="relative block"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Next up
          </span>
          {cd && (
            <span
              className={cn(
                "rounded-full border border-primary/25 bg-foreground/[0.07] px-2.5 py-0.5 text-xs font-medium tabular-nums",
                urgencyTextClass(cd.urgency),
              )}
            >
              {cd.label}
            </span>
          )}
        </div>
        <p className="mt-3 text-lg font-semibold leading-snug tracking-[-0.01em] text-foreground">
          {assignment.name}
        </p>
        <p className="mt-1.5 flex items-baseline gap-2 text-sm tabular-nums text-muted-foreground">
          {/* The class's color, the same as its To-Do checkboxes. */}
          <span
            className="inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <span>{detail}</span>
        </p>
        {progress > 0 && (
          <div
            className="mt-3 flex items-center gap-2.5"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={progress >= 75 ? `Almost there, ${progress}% done` : `${progress}% done`}
          >
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </span>
            <span className="text-xs font-medium tabular-nums text-foreground">{progress}%</span>
          </div>
        )}
      </Link>
      <Link
        to="/study-session"
        search={{ assignment: assignment.id }}
        preload="intent"
        className="relative mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.04] text-sm font-medium text-foreground transition-colors hover:border-foreground/25 hover:bg-foreground/[0.07]"
      >
        <Play className="h-4 w-4 fill-primary text-primary" aria-hidden="true" />
        Start
      </Link>
    </div>
  );
}

/** While everything loads: the page's shapes, gently pulsing, no numbers. */
function DashboardHeroSkeleton() {
  return (
    <section
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)] lg:items-start lg:gap-6"
      role="status"
      aria-label="Loading"
    >
      <div className="space-y-3 px-1 pt-1">
        <span className="skeleton-shimmer block h-4 w-40" />
        <span className="skeleton-shimmer block h-10 w-72 max-w-full" />
        <span className="skeleton-shimmer block h-4 w-56" />
        <span className="mt-6 grid max-w-xl grid-cols-7 pt-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="flex justify-center">
              <span className="skeleton-shimmer block h-8 w-8 rounded-full" />
            </span>
          ))}
        </span>
      </div>
      <span className="skeleton-shimmer block h-48 rounded-[1.6rem]" />
    </section>
  );
}
