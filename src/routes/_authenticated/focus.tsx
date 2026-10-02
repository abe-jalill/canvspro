import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Check, Clock, ExternalLink, Layers, Target, TimerReset } from "lucide-react";
import { getAllAssignmentsFn, getCoursesFn, type AssignmentItem } from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { GlassCard, Skeleton, ErrorState } from "@/components/glass-card";
import { Segmented } from "@/components/segmented";
import { PageTabs } from "@/components/page-tabs";
import { TODAY_TABS } from "@/lib/page-tab-sets";
import { cn } from "@/lib/utils";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { getCountdown, urgencyTextClass } from "@/lib/countdown";
import { defaultEstimateMinutes } from "@/lib/get-it-done";
import { useAssignmentMetaMap } from "@/hooks/use-assignment-meta";
import { isFocusWindow, isDueInFocusWindow, type FocusWindow } from "@/lib/focus-window";
import { isAssignmentComplete, isAssignmentVisible } from "@/lib/assignment-window";
import { customToAssignmentItem, useCustomAssignments } from "@/lib/custom-assignments";
import { toast } from "sonner";

import {
  coursesQueryOptions as coursesQO,
  assignmentsQueryOptions as assignmentsQO,
} from "@/lib/canvas.queries";
import { AssignmentRowSkeleton, SkeletonBlock } from "@/components/skeletons/dashboard-skeletons";

export const Route = createFileRoute("/_authenticated/focus")({
  head: () => ({
    meta: [
      { title: "Focus — CanvasPro" },
      {
        name: "description",
        content:
          "Your next deadline, what's at stake, and everything due soon, laid out day by day or class by class.",
      },
      { property: "og:title", content: "Focus — CanvasPro" },
      {
        property: "og:description",
        content:
          "Your next deadline, what's at stake, and everything due soon, laid out day by day or class by class.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { window: FocusWindow } => ({
    window: isFocusWindow(search.window) ? search.window : "7",
  }),
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(assignmentsQO);
      void context.queryClient.ensureQueryData(coursesQO);
    }
  },
  component: FocusPage,
});

const WINDOW_LABELS: Record<FocusWindow, string> = {
  all: "All dates",
  "1": "1 day",
  "2": "2 days",
  "3": "3 days",
  "7": "1 week",
  overdue: "Overdue",
};

type ViewMode = "day" | "class";
const VIEW_KEY = "canvas:focus-view";
const DAY_MS = 24 * 60 * 60 * 1000;

/** A stable, distinct hue per class so the same class reads the same everywhere on the page. */
function classHue(courseId: number): number {
  return (Math.abs(courseId) * 137.508) % 360;
}

function ClassDot({ courseId, className }: { courseId: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={{ background: `hsl(${classHue(courseId)} 70% 60%)` }}
    />
  );
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayHeading(dayStart: number, today: number) {
  const diff = Math.round((dayStart - today) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(dayStart);
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function timeLeft(ms: number) {
  if (ms <= 0) return { value: "Now", unit: "" };
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rest = mins % 60;
  if (days > 0) return { value: `${days}d ${hours}h`, unit: "left" };
  if (hours > 0) return { value: `${hours}h ${rest}m`, unit: "left" };
  return { value: `${rest}m`, unit: "left" };
}

function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("day");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === "day" || saved === "class") setMode(saved);
    } catch {
      /* default view is fine */
    }
  }, []);
  const update = (next: ViewMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  };
  return [mode, update];
}

function FocusPage() {
  const navigate = useNavigate();
  const { window: win } = Route.useSearch();
  const assignments = useQuery(assignmentsQO);
  const courses = useQuery(coursesQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const custom = useCustomAssignments();
  const metaMap = useAssignmentMetaMap();
  const [showCompleted, setShowCompleted] = useState(false);
  const [view, setView] = useViewMode();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const courseById = new Map((courses.data ?? []).map((course) => [course.id, course]));
  const allAssignments = [
    ...(assignments.data ?? []),
    ...custom.list.map((item) => customToAssignmentItem(item, courseById.get(item.course_id))),
  ];
  const dueInWindow = allAssignments.filter((a) => isDueInFocusWindow(a, win, now));
  const completedInWindow = dueInWindow.filter((a) => isAssignmentComplete(a, completed.has(a.id)));
  const unfinished = dueInWindow
    .filter((a) => isAssignmentVisible(a, completed.has(a.id), false, now))
    .sort(byDue);
  const hiddenCompleteCount = completedInWindow.length;
  const inWindow = (showCompleted ? [...unfinished, ...completedInWindow] : unfinished).sort(byDue);

  const courseName = (a: AssignmentItem) => {
    const c = courseById.get(a.course_id);
    return displayCourseName(c?.name ?? a.course_name, c?.course_code ?? a.course_code);
  };
  const estimateFor = (a: AssignmentItem) =>
    metaMap.get(a.id)?.estimatedMinutes ?? defaultEstimateMinutes(a);

  function toggleComplete(assignment: AssignmentItem) {
    const wasComplete = completed.has(assignment.id);
    completed.toggle(assignment.id);
    if (!wasComplete)
      toast.success("Marked complete", {
        description: assignment.name,
        action: { label: "Undo", onClick: () => completed.remove(assignment.id) },
      });
  }

  // Summary numbers for the top of the page.
  const pointsAtStake = Math.round(unfinished.reduce((s, a) => s + (a.points_possible ?? 0), 0));
  const minutesNeeded = unfinished.reduce((s, a) => s + estimateFor(a), 0);
  const classCount = new Set(unfinished.map((a) => a.course_id)).size;
  const next = unfinished.find((a) => a.due_at && Date.parse(a.due_at) >= now) ?? unfinished[0];

  // Seven-day load strip, always starting today.
  const today = startOfDay(now);
  const strip = Array.from({ length: 7 }, (_, i) => {
    const start = today + i * DAY_MS;
    const items = allAssignments.filter((a) => {
      if (!a.due_at || !isAssignmentVisible(a, completed.has(a.id), false, now)) return false;
      const t = Date.parse(a.due_at);
      return t >= start && t < start + DAY_MS;
    });
    return { start, items };
  });
  const stripMax = Math.max(1, ...strip.map((d) => d.items.length));
  const pickedDay = strip.find((d) => d.start === selectedDay) ?? null;

  const loading =
    assignments.isLoading || courses.isLoading || completed.isLoading || custom.isLoading;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-10">
      <PageTabs tabs={TODAY_TABS} label="Today sections" />
      <header className="premium-reveal flex flex-wrap items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Focus
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {win === "all"
              ? "Everything ahead"
              : win === "overdue"
                ? "Overdue work"
                : `Due within ${WINDOW_LABELS[win]}`}
          </h1>
        </div>
        <Segmented<FocusWindow>
          value={win}
          onChange={(window) => void navigate({ to: "/focus", search: { window }, replace: true })}
          className="max-w-full overflow-x-auto"
          options={[
            { id: "overdue", label: "Overdue" },
            { id: "1", label: "1 day" },
            { id: "3", label: "3 days" },
            { id: "7", label: "1 week" },
            { id: "all", label: "All" },
          ]}
        />
      </header>

      {loading ? (
        <div className="space-y-5">
          <GlassCard strong>
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="mt-4 h-10 w-2/3" />
            <SkeletonBlock className="mt-3 h-4 w-1/2" />
          </GlassCard>
          <GlassCard>
            <div className="space-y-2">
              <AssignmentRowSkeleton index={0} />
              <AssignmentRowSkeleton index={1} />
              <AssignmentRowSkeleton index={2} />
            </div>
          </GlassCard>
        </div>
      ) : assignments.isError ? (
        <GlassCard>
          <ErrorState message={(assignments.error as Error).message} />
        </GlassCard>
      ) : (
        <>
          {/* Next deadline + what's at stake */}
          <section className="glass-panel-strong get-it-done-next premium-reveal relative overflow-hidden p-5 sm:p-7">
            {next ? (
              <NextDeadline
                assignment={next}
                course={courseName(next)}
                estimate={estimateFor(next)}
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="glass-inset flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight">
                    {win === "overdue" ? "Nothing overdue." : "Nothing left in this window."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hiddenCompleteCount > 0
                      ? `${hiddenCompleteCount} finished here. Nice work.`
                      : "Pick a longer range above to look further ahead."}
                  </p>
                </div>
              </div>
            )}

            <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-foreground/10 pt-5">
              <Metric icon={<Target className="h-3.5 w-3.5" />} label="Left to do" value={String(unfinished.length)} detail={`across ${classCount} ${classCount === 1 ? "class" : "classes"}`} />
              <Metric icon={<Layers className="h-3.5 w-3.5" />} label="Points at stake" value={String(pointsAtStake)} detail="if left undone" />
              <Metric icon={<Clock className="h-3.5 w-3.5" />} label="Time needed" value={formatMinutes(minutesNeeded)} detail="estimated" />
            </dl>
          </section>

          {/* Week at a glance */}
          <section className="glass-panel premium-reveal p-4 sm:p-5" style={{ animationDelay: "55ms" }}>
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold tracking-tight">
                Next 7 days
                <span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">Tap a day to see what&apos;s due</span>
              </h2>
              <span className="text-xs text-muted-foreground">
                {strip.reduce((n, d) => n + d.items.length, 0)} due
              </span>
            </div>
            <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {strip.map((day, i) => {
                const heavy = day.items.length / stripMax;
                return (
                  <li key={day.start}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDay((current) => (current === day.start ? null : day.start))
                      }
                      aria-pressed={selectedDay === day.start}
                      aria-label={`${dayHeading(day.start, today)}: ${day.items.length} due. Show assignments`}
                      className={cn(
                        "glass-hover flex w-full flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 transition-colors",
                        selectedDay === day.start
                          ? "border-foreground/60 bg-foreground/[0.08] ring-1 ring-foreground/30"
                          : i === 0
                            ? "border-primary/40 bg-primary/[0.06]"
                            : "border-foreground/[0.07]",
                      )}
                    >
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {i === 0
                        ? "Today"
                        : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day.start)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {new Date(day.start).getDate()}
                    </span>
                    <span className="flex h-10 w-full items-end justify-center">
                      <span
                        className="block w-2.5 rounded-full bg-primary transition-all"
                        style={{
                          height: day.items.length ? `${20 + heavy * 80}%` : "3px",
                          opacity: day.items.length ? 0.35 + heavy * 0.65 : 0.15,
                        }}
                      />
                    </span>
                    <span className="flex min-h-2 flex-wrap justify-center gap-0.5">
                      {day.items.slice(0, 4).map((a) => (
                        <ClassDot key={a.id} courseId={a.course_id} className="h-1.5 w-1.5" />
                      ))}
                    </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {pickedDay && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02]">
                <div className="flex items-baseline justify-between px-4 pt-3 sm:px-5">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {dayHeading(pickedDay.start, today)}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
                        pickedDay.start,
                      )}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
                {pickedDay.items.length === 0 ? (
                  <p className="px-4 pb-4 pt-2 text-sm text-muted-foreground sm:px-5">
                    Nothing due this day.
                  </p>
                ) : (
                  <ul className="mt-1 divide-y divide-foreground/[0.07]">
                    {[...pickedDay.items].sort(byDue).map((a) => (
                      <FocusRow
                        key={a.id}
                        assignment={a}
                        course={courseName(a)}
                        estimate={estimateFor(a)}
                        done={isAssignmentComplete(a, completed.has(a.id))}
                        canvasDone={isAssignmentComplete(a, false)}
                        ready={completed.ready}
                        onToggle={() => toggleComplete(a)}
                        showCourse
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* The list */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="glass-inset inline-flex rounded-xl p-1" role="tablist" aria-label="Group by">
              {(
                [
                  ["day", "By day", <CalendarDays key="d" className="h-3.5 w-3.5" />],
                  ["class", "By class", <Layers key="c" className="h-3.5 w-3.5" />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
                    view === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(event) => setShowCompleted(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Show finished{hiddenCompleteCount > 0 ? ` (${hiddenCompleteCount})` : ""}
            </label>
          </div>

          {inWindow.length === 0 ? null : view === "day" ? (
            <div className="space-y-4">
              {groupByDay(inWindow, today).map((group) => (
                <section key={group.key} className="glass-panel overflow-hidden">
                  <header className="flex items-baseline justify-between px-5 pt-4 sm:px-6">
                    <h3
                      className={cn(
                        "text-sm font-semibold tracking-tight",
                        group.key === "overdue" && "text-red-500",
                      )}
                    >
                      {group.label}
                      {group.date && (
                        <span className="ml-2 font-normal text-muted-foreground">{group.date}</span>
                      )}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {group.items.length} {group.items.length === 1 ? "item" : "items"}
                    </span>
                  </header>
                  <ul className="mt-2 divide-y divide-foreground/[0.07]">
                    {group.items.map((a) => (
                      <FocusRow
                        key={a.id}
                        assignment={a}
                        course={courseName(a)}
                        estimate={estimateFor(a)}
                        done={isAssignmentComplete(a, completed.has(a.id))}
                        canvasDone={isAssignmentComplete(a, false)}
                        ready={completed.ready}
                        onToggle={() => toggleComplete(a)}
                        showCourse
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {groupByClass(inWindow).map((group) => {
                const points = Math.round(group.items.reduce((s, a) => s + (a.points_possible ?? 0), 0));
                const share = pointsAtStake > 0 ? Math.min(100, (points / pointsAtStake) * 100) : 0;
                return (
                  <section key={group.courseId} className="glass-panel overflow-hidden">
                    <header className="px-5 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight">
                          <ClassDot courseId={group.courseId} />
                          <span className="truncate">{courseName(group.items[0])}</span>
                        </h3>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {group.items.length} · {points} pt
                        </span>
                      </div>
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-foreground/10" title={`${Math.round(share)}% of the points at stake`}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${share}%`, background: `hsl(${classHue(group.courseId)} 70% 60%)` }}
                        />
                      </div>
                    </header>
                    <ul className="mt-2 divide-y divide-foreground/[0.07]">
                      {group.items.map((a) => (
                        <FocusRow
                          key={a.id}
                          assignment={a}
                          course={courseName(a)}
                          estimate={estimateFor(a)}
                          done={isAssignmentComplete(a, completed.has(a.id))}
                          canvasDone={isAssignmentComplete(a, false)}
                          ready={completed.ready}
                          onToggle={() => toggleComplete(a)}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function byDue(a: AssignmentItem, b: AssignmentItem) {
  return (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity);
}

function groupByDay(items: AssignmentItem[], today: number) {
  const groups = new Map<string, { key: string; label: string; date: string | null; items: AssignmentItem[] }>();
  for (const a of items) {
    let key = "none";
    let label = "No due date";
    let date: string | null = null;
    if (a.due_at) {
      const start = startOfDay(Date.parse(a.due_at));
      if (Date.parse(a.due_at) < Date.now()) {
        key = "overdue";
        label = "Overdue";
      } else {
        key = String(start);
        label = dayHeading(start, today);
        date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(start);
      }
    }
    const g = groups.get(key) ?? { key, label, date, items: [] };
    g.items.push(a);
    groups.set(key, g);
  }
  return [...groups.values()];
}

function groupByClass(items: AssignmentItem[]) {
  const groups = new Map<number, { courseId: number; items: AssignmentItem[] }>();
  for (const a of items) {
    const g = groups.get(a.course_id) ?? { courseId: a.course_id, items: [] };
    g.items.push(a);
    groups.set(a.course_id, g);
  }
  // Class with the soonest deadline first.
  return [...groups.values()].sort((x, y) => byDue(x.items[0], y.items[0]));
}

function NextDeadline({
  assignment,
  course,
  estimate,
}: {
  assignment: AssignmentItem;
  course: string;
  estimate: number;
}) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  const due = assignment.due_at ? Date.parse(assignment.due_at) : null;
  const left = due != null ? timeLeft(due - tick) : null;
  const overdue = due != null && due < tick;
  const cd = getCountdown(assignment.due_at);

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          {overdue ? "Overdue" : "Next deadline"}
        </p>
        <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          {assignment.name}
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <ClassDot courseId={assignment.course_id} />
          <span>{course}</span>
          <span className="opacity-40">·</span>
          <span>{cd?.fullDate ?? "No due date"}</span>
          {assignment.points_possible ? (
            <>
              <span className="opacity-40">·</span>
              <span>{assignment.points_possible} pt</span>
            </>
          ) : null}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/study-session"
            search={{ assignment: assignment.id }}
            className="glass-hover inline-flex min-h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            <TimerReset className="h-4 w-4" />
            Study for {formatMinutes(estimate)}
          </Link>
          {assignment.html_url && (
            <a
              href={assignment.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-hover inline-flex min-h-10 items-center gap-2 rounded-xl border border-glass-border px-4 text-sm font-medium"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Canvas
            </a>
          )}
        </div>
      </div>
      {left && (
        <div className="sm:text-right" aria-live="off">
          <p
            className={cn(
              "text-4xl font-semibold tabular-nums tracking-[-0.04em] sm:text-5xl",
              overdue ? "text-red-500" : cd ? urgencyTextClass(cd.urgency) : undefined,
            )}
          >
            {overdue ? "Late" : left.value}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {overdue ? "past due" : left.unit}
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{value}</dd>
      <dd className="text-[11px] text-muted-foreground">{detail}</dd>
    </div>
  );
}

function FocusRow({
  assignment: a,
  course,
  estimate,
  done,
  canvasDone,
  ready,
  onToggle,
  showCourse = false,
}: {
  assignment: AssignmentItem;
  course: string;
  estimate: number;
  done: boolean;
  canvasDone: boolean;
  ready: boolean;
  onToggle: () => void;
  showCourse?: boolean;
}) {
  const cd = getCountdown(a.due_at, { completed: done });
  const time = a.due_at
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(Date.parse(a.due_at))
    : null;
  return (
    <li className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-5 py-3.5 sm:px-6", done && "opacity-55")}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!ready || canvasDone}
        aria-label={`Mark ${a.name} ${done ? "incomplete" : "complete"}`}
        aria-pressed={done}
        className="group mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground/30 transition-colors hover:border-foreground/60 disabled:cursor-default"
      >
        <Check
          className={cn("h-3 w-3 transition-opacity group-hover:opacity-100", done ? "opacity-100" : "opacity-0")}
          aria-hidden="true"
        />
      </button>
      <div className="min-w-0">
        <p className={cn("text-sm font-medium leading-snug", done && "line-through")}>{a.name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {showCourse && (
            <>
              <ClassDot courseId={a.course_id} />
              <span>{course}</span>
              <span className="opacity-40">·</span>
            </>
          )}
          {a.points_possible ? <span>{a.points_possible} pt</span> : null}
          {a.points_possible ? <span className="opacity-40">·</span> : null}
          <span>~{formatMinutes(estimate)}</span>
          {done && (
            <>
              <span className="opacity-40">·</span>
              <span>{canvasDone ? "Done in Canvas" : "Marked done"}</span>
            </>
          )}
          {!done && a.submission?.missing && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-red-500">Missing</span>
            </>
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <AssignmentDescriptionLink assignmentId={a.id} />
          {a.html_url && (
            <a
              href={a.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Open in Canvas <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className={cn("whitespace-nowrap text-sm font-medium tabular-nums", cd ? urgencyTextClass(cd.urgency) : "text-muted-foreground")}>
          {cd ? cd.label : "No due date"}
        </p>
        {time && <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{time}</p>}
      </div>
    </li>
  );
}
