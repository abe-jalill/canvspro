import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  FileText,
  ExternalLink,
  MoreHorizontal,
  RotateCcw,
  Shuffle,
  SkipForward,
  TimerReset,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAllAssignmentsFn, getCoursesFn, type AssignmentItem } from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { CompleteToggle } from "@/components/complete-toggle";
import { Segmented } from "@/components/segmented";
import { PageTabs } from "@/components/page-tabs";
import { STUDY_TABS } from "@/lib/page-tab-sets";
import { cn } from "@/lib/utils";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { useAssignmentMetaMap, useSetAssignmentEstimate } from "@/hooks/use-assignment-meta";
import {
  buildTodayPlan,
  rankGetItDoneAssignments,
  defaultEstimateMinutes,
  filterAssignmentsForUpcomingWindow,
  type PlanItem,
  type RankedAssignment,
} from "@/lib/get-it-done";
import { customToAssignmentItem, useCustomAssignments } from "@/lib/custom-assignments";
import { useScopedKey } from "@/lib/user-scope";
import {
  emptyGetItDonePrefs,
  localPlanDateKey,
  normalizeGetItDonePrefs,
  type AssignmentWindow,
  type GetItDonePrefs,
} from "@/lib/get-it-done-prefs";

const GET_IT_DONE_PREFS_KEY = "canvas:get-it-done";

import {
  coursesQueryOptions as coursesQO,
  assignmentsQueryOptions as assignmentsQO,
} from "@/lib/canvas.queries";
import { SkeletonBlock } from "@/components/skeletons/dashboard-skeletons";

export const Route = createFileRoute("/_authenticated/get-it-done")({
  head: () => ({
    meta: [
      { title: "Get It Done — CanvasPro" },
      {
        name: "description",
        content:
          "A simple CanvasPro plan that recommends the best assignment to start now and builds a realistic plan for today.",
      },
      { property: "og:title", content: "Get It Done — CanvasPro" },
      {
        property: "og:description",
        content:
          "A simple CanvasPro plan that recommends the best assignment to start now and builds a realistic plan for today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(assignmentsQO);
      void context.queryClient.ensureQueryData(coursesQO);
    }
  },
  component: GetItDonePage,
});

function useStoredPrefs() {
  const key = useScopedKey(GET_IT_DONE_PREFS_KEY);
  const [prefs, setPrefs] = useState<GetItDonePrefs>(() => emptyGetItDonePrefs());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      setPrefs(
        raw
          ? normalizeGetItDonePrefs(JSON.parse(raw) as Partial<GetItDonePrefs>)
          : emptyGetItDonePrefs(),
      );
    } catch {
      setPrefs(emptyGetItDonePrefs());
    }
  }, [key]);

  const write = (next: GetItDonePrefs | ((current: GetItDonePrefs) => GetItDonePrefs)) => {
    setPrefs((current) => {
      const value = typeof next === "function" ? next(current) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // ignore local persistence failures
      }
      return value;
    });
  };

  return [prefs, write] as const;
}

function dueLabel(dueAt: string | null) {
  if (!dueAt) return "No due date";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "No due date";
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(due);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(due) - startOf(new Date())) / 86_400_000);
  if (days < 0) return `Was due ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(due)}`;
  if (days === 0) return `Due today, ${time}`;
  if (days === 1) return `Due tomorrow, ${time}`;
  const day = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(due);
  return `Due ${day}, ${time}`;
}

/** Only states that need attention get a tag; "not started" is the default. */
function attentionTag(assignment: AssignmentItem, done: boolean): string | null {
  if (done) return null;
  const submission = assignment.submission;
  if (submission?.missing) return "Missing";
  if (assignment.due_at && new Date(assignment.due_at).getTime() < Date.now()) return "Overdue";
  return null;
}

function openAssignment(assignment: AssignmentItem) {
  if (!assignment.html_url) return;
  window.open(assignment.html_url, "_blank", "noopener,noreferrer");
}

function formatMinutes(minutes: number | null) {
  if (minutes == null) return "No estimate";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function numericWindowDays(windowDays: AssignmentWindow): 7 | 14 {
  return windowDays === "14" ? 14 : 7;
}

function GetItDonePage() {
  const assignments = useQuery(assignmentsQO);
  const courses = useQuery(coursesQO);
  const custom = useCustomAssignments();
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const metaMap = useAssignmentMetaMap();
  const setEstimate = useSetAssignmentEstimate();
  const [prefs, setPrefs] = useStoredPrefs();
  const [choiceOffset, setChoiceOffset] = useState(0);
  const now = Date.now();
  const windowDays = numericWindowDays(prefs.windowDays);

  const courseById = useMemo(
    () =>
      new Map(
        (courses.data ?? []).map((course) => [
          course.id,
          { name: course.name, course_code: course.course_code },
        ]),
      ),
    [courses.data],
  );

  const allAssignments = useMemo(() => {
    // Keep the canonical feed intact. The 7/14-day rule is applied only by
    // visibleAssignments below and is never written back to the shared query.
    return [
      ...(assignments.data ?? []),
      ...custom.list.map((item) => customToAssignmentItem(item, courseById.get(item.course_id))),
    ];
  }, [assignments.data, custom.list, courseById]);

  const visibleAssignments = useMemo(
    () => filterAssignmentsForUpcomingWindow(allAssignments, now, windowDays),
    [allAssignments, now, windowDays],
  );

  const estimates = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const [id, meta] of metaMap.entries()) map.set(id, meta.estimatedMinutes);
    return map;
  }, [metaMap]);

  const skipped = useMemo(() => new Set(prefs.skipped), [prefs.skipped]);
  const ranked = useMemo(
    () =>
      rankGetItDoneAssignments({
        assignments: visibleAssignments,
        completed: completed.has,
        estimates,
        skipped,
      }),
    [visibleAssignments, completed.has, estimates, skipped],
  );

  const recommendation = ranked[choiceOffset] ?? ranked[0] ?? null;

  const plan = useMemo(
    () =>
      buildTodayPlan({
        assignments: visibleAssignments,
        completed: completed.has,
        estimates,
        skipped,
        manualOrder: prefs.planOrder,
      }),
    [visibleAssignments, completed.has, estimates, skipped, prefs.planOrder],
  );

  const totalMinutes = plan.reduce((sum, item) => sum + item.plannedMinutes, 0);
  const completeCount = plan.filter((item) => completed.has(item.assignment.id)).length;
  const isLoading = assignments.isLoading || courses.isLoading;
  const error = assignments.isError
    ? (assignments.error as Error)
    : courses.isError
      ? (courses.error as Error)
      : null;

  function skipAssignment(id: number) {
    setChoiceOffset(0);
    setPrefs((current) => ({
      ...current,
      skipped: Array.from(new Set([...current.skipped, String(id)])),
      planOrder: current.planOrder.filter((item) => item !== String(id)),
      planDate: localPlanDateKey(),
    }));
  }

  function chooseAnother() {
    setChoiceOffset((current) => {
      if (ranked.length <= 1) return 0;
      return (current + 1) % ranked.length;
    });
  }

  function regeneratePlan() {
    setChoiceOffset(0);
    setPrefs((current) => ({
      ...emptyGetItDonePrefs(),
      windowDays: current.windowDays,
      version: Date.now(),
    }));
  }

  function setWindowDays(nextWindowDays: AssignmentWindow) {
    setChoiceOffset(0);
    const nextVisible = filterAssignmentsForUpcomingWindow(
      allAssignments,
      Date.now(),
      numericWindowDays(nextWindowDays),
    );
    setPrefs((current) => ({
      ...current,
      windowDays: nextWindowDays,
      planOrder: [],
      skipped: current.skipped.filter((id) =>
        nextVisible.some((assignment) => String(assignment.id) === id),
      ),
      planDate: localPlanDateKey(),
      version: Date.now(),
    }));
  }

  function movePlanItem(id: number, direction: -1 | 1) {
    const ids = plan.map((item) => String(item.assignment.id));
    const index = ids.indexOf(String(id));
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setPrefs((current) => ({ ...current, planOrder: next, planDate: localPlanDateKey() }));
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Header windowDays={prefs.windowDays} onWindowDaysChange={setWindowDays} />
        {/* Keep the final hierarchy while Canvas data loads so the page never jumps. */}
        <GlassCard strong className="space-y-4 p-6 sm:p-7">
          <SkeletonBlock className="h-5 w-44 rounded-full" />
          <div className="space-y-2">
            <SkeletonBlock className="h-7 w-2/3" />
            <SkeletonBlock className="h-4 w-1/3" />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <SkeletonBlock className="h-11 w-44 rounded-xl" />
            <SkeletonBlock className="h-11 w-28 rounded-xl" />
          </div>
        </GlassCard>
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-foreground/10 pb-3">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="glass-inset flex items-center justify-between p-3.5">
                <div className="space-y-1.5 min-w-0">
                  <SkeletonBlock className="h-4 w-44 sm:w-60" />
                  <SkeletonBlock className="h-3 w-28" />
                </div>
                <SkeletonBlock className="h-6 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Header windowDays={prefs.windowDays} onWindowDaysChange={setWindowDays} />
        <GlassCard>
          <ErrorState message={error.message} />
        </GlassCard>
      </div>
    );
  }

  const remainingMinutes = plan
    .filter((item) => !completed.has(item.assignment.id))
    .reduce((sum, item) => sum + item.plannedMinutes, 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
      <Header
        windowDays={prefs.windowDays}
        onWindowDaysChange={setWindowDays}
        summary={
          plan.length > 0
            ? `${plan.length - completeCount} of ${plan.length} left today · about ${formatMinutes(remainingMinutes)}`
            : undefined
        }
      />

      {recommendation ? (
        <RecommendationCard
          item={recommendation}
          completed={completed.has(recommendation.assignment.id)}
          onComplete={() => completed.toggle(recommendation.assignment.id)}
          onSkip={() => skipAssignment(recommendation.assignment.id)}
          onChooseAnother={ranked.length > 1 ? chooseAnother : undefined}
        />
      ) : (
        <GlassCard strong>
          <EmptyState
            title="Nothing needs your attention right now."
            message={
              allAssignments.length === 0
                ? "Canvas did not return any assignments. Refresh Canvas data or check your Canvas connection in Settings."
                : visibleAssignments.length === 0
                  ? `Nothing is due in the next ${prefs.windowDays === "7" ? "week" : "two weeks"}.`
                  : "Everything due in this window is done or skipped for today."
            }
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </GlassCard>
      )}

      <TodayPlanCard
        plan={plan}
        totalMinutes={totalMinutes}
        completeCount={completeCount}
        completed={completed}
        upNextId={recommendation?.assignment.id ?? null}
        onStart={openAssignment}
        onSkip={skipAssignment}
        onMove={movePlanItem}
        onRegenerate={regeneratePlan}
        onEstimate={(assignment, minutes) =>
          setEstimate.mutate({
            assignmentId: assignment.id,
            courseId: assignment.course_id,
            minutes,
          })
        }
        estimatePending={setEstimate.isPending}
      />
    </div>
  );
}

function Header({
  windowDays,
  onWindowDaysChange,
  summary,
}: {
  windowDays: AssignmentWindow;
  onWindowDaysChange: (days: AssignmentWindow) => void;
  summary?: string;
}) {
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  return (
    <>
    <PageTabs tabs={STUDY_TABS} label="Study sections" />
    <header className="premium-reveal flex flex-wrap items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {today}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Get It Done</h1>
        {summary && <p className="mt-1.5 text-sm text-muted-foreground">{summary}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">Looking ahead</span>
        <Segmented<AssignmentWindow>
          value={windowDays}
          onChange={onWindowDaysChange}
          options={[
            { id: "7", label: "1 week" },
            { id: "14", label: "2 weeks" },
          ]}
        />
      </div>
    </header>
    </>
  );
}

function RecommendationCard({
  item,
  completed,
  onComplete,
  onSkip,
  onChooseAnother,
}: {
  item: RankedAssignment;
  completed: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onChooseAnother?: () => void;
}) {
  const assignment = item.assignment;
  const estimate = item.estimatedMinutes ?? defaultEstimateMinutes(assignment);

  return (
    <section className="glass-panel-strong get-it-done-next relative min-w-0 overflow-hidden p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Start here</p>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More options for this suggestion"
            className="glass-hover flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onChooseAnother && (
              <DropdownMenuItem onSelect={onChooseAnother}>
                <Shuffle className="mr-2 h-4 w-4" /> Suggest something else
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onSkip}>
              <SkipForward className="mr-2 h-4 w-4" /> Skip for today
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <CompleteToggle
          done={completed}
          onToggle={onComplete}
          label={assignment.name}
          className="mt-1.5"
        />
        <div className="min-w-0">
          <h2
            className={cn(
              "text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl",
              completed && "line-through opacity-70",
            )}
          >
            {assignment.name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {displayCourseName(assignment.course_name, assignment.course_code)}
            <span className="mx-2 opacity-40">·</span>
            {dueLabel(assignment.due_at)}
            <span className="mx-2 opacity-40">·</span>
            about {formatMinutes(estimate)}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground/80">{item.explanation}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 sm:pl-9">
        <Link
          to="/study-session"
          search={{ assignment: assignment.id }}
          className="glass-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background"
        >
          <TimerReset className="h-4 w-4" />
          Start a study session
        </Link>
        {assignment.html_url && (
          <a
            href={assignment.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-glass-border px-4 text-sm font-medium"
          >
            <ExternalLink className="h-4 w-4" />
            Open in Canvas
          </a>
        )}
        <AssignmentDescriptionLink assignmentId={assignment.id} className="ml-1" />
      </div>
    </section>
  );
}

function TodayPlanCard({
  plan,
  totalMinutes,
  completeCount,
  completed,
  upNextId,
  onStart,
  onSkip,
  onMove,
  onRegenerate,
  onEstimate,
  estimatePending,
}: {
  plan: PlanItem[];
  totalMinutes: number;
  completeCount: number;
  completed: ReturnType<typeof useLocalSet>;
  upNextId: number | null;
  onStart: (assignment: AssignmentItem) => void;
  onSkip: (id: number) => void;
  onMove: (id: number, direction: -1 | 1) => void;
  onRegenerate: () => void;
  onEstimate: (assignment: AssignmentItem, minutes: number | null) => void;
  estimatePending: boolean;
}) {
  const progress = plan.length === 0 ? 0 : Math.round((completeCount / plan.length) * 100);

  return (
    <section className="glass-panel min-w-0 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Today&apos;s plan</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {plan.length === 0
              ? "Nothing scheduled for today."
              : `${completeCount} of ${plan.length} done · ${formatMinutes(totalMinutes)} planned`}
          </p>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="glass-hover inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          title="Rebuild the plan and bring back skipped work"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset plan
        </button>
      </header>

      {plan.length === 0 ? (
        <div className="px-5 pb-5 pt-3 sm:px-6">
          <EmptyState
            title="No plan needed."
            message="Everything urgent is complete, skipped, or already submitted."
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </div>
      ) : (
        <>
          <div
            className="mx-5 mt-4 h-1 overflow-hidden rounded-full bg-foreground/10 sm:mx-6"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Today's plan progress"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ol className="mt-3 divide-y divide-foreground/[0.07]">
            {plan.map((item, index) => (
              <PlanRow
                key={item.assignment.id}
                item={item}
                index={index}
                count={plan.length}
                upNext={item.assignment.id === upNextId}
                done={completed.has(item.assignment.id)}
                onToggle={() => completed.toggle(item.assignment.id)}
                onStart={() => onStart(item.assignment)}
                onSkip={() => onSkip(item.assignment.id)}
                onMove={(direction) => onMove(item.assignment.id, direction)}
                onEstimate={(minutes) => onEstimate(item.assignment, minutes)}
                estimatePending={estimatePending}
              />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function PlanRow({
  item,
  index,
  count,
  upNext,
  done,
  onToggle,
  onStart,
  onSkip,
  onMove,
  onEstimate,
  estimatePending,
}: {
  item: PlanItem;
  index: number;
  count: number;
  upNext: boolean;
  done: boolean;
  onToggle: () => void;
  onStart: () => void;
  onSkip: () => void;
  onMove: (direction: -1 | 1) => void;
  onEstimate: (minutes: number | null) => void;
  estimatePending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(String(item.estimatedMinutes ?? item.plannedMinutes));
  const assignment = item.assignment;
  const tag = attentionTag(assignment, done);

  useEffect(() => {
    setMinutes(String(item.estimatedMinutes ?? item.plannedMinutes));
  }, [item.estimatedMinutes, item.plannedMinutes]);

  function saveEstimate() {
    const parsed = Number(minutes);
    onEstimate(Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null);
    setEditing(false);
  }

  return (
    <li
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-5 py-4 transition-colors hover:bg-foreground/[0.02] sm:px-6",
        done && "opacity-55",
      )}
    >
      <CompleteToggle done={done} onToggle={onToggle} label={assignment.name} className="mt-0.5" />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn("text-sm font-medium leading-snug", done && "line-through")}>
            {assignment.name}
          </p>
          {upNext && !done && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Up next
            </span>
          )}
          {tag && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-500">
              {tag}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {displayCourseName(assignment.course_name, assignment.course_code)}
          <span className="mx-1.5 opacity-40">·</span>
          {dueLabel(assignment.due_at)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {editing ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              saveEstimate();
            }}
          >
            <input
              type="number"
              min={5}
              step={5}
              value={minutes}
              autoFocus
              onChange={(event) => setMinutes(event.target.value)}
              className="h-8 w-16 rounded-lg border border-glass-border bg-background/50 px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
              aria-label={`Estimated minutes for ${assignment.name}`}
            />
            <button
              type="submit"
              disabled={estimatePending}
              className="glass-hover h-8 rounded-lg border border-glass-border px-2.5 text-xs font-medium disabled:opacity-50"
            >
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Change time estimate"
            aria-label={`Time estimate for ${assignment.name}: ${formatMinutes(
              item.estimatedMinutes ?? defaultEstimateMinutes(assignment),
            )}. Change`}
            className="glass-hover inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs tabular-nums text-muted-foreground hover:text-foreground"
          >
            <Clock className="h-3.5 w-3.5" />
            {formatMinutes(item.estimatedMinutes ?? defaultEstimateMinutes(assignment))}
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`More options for ${assignment.name}`}
            className="glass-hover flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {assignment.html_url && (
              <DropdownMenuItem onSelect={onStart}>
                <ExternalLink className="mr-2 h-4 w-4" /> Open in Canvas
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to="/assignments" search={{ assignment: String(assignment.id) }}>
                <FileText className="mr-2 h-4 w-4" /> See description
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
              <ArrowUp className="mr-2 h-4 w-4" /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(1)}>
              <ArrowDown className="mr-2 h-4 w-4" /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSkip}>
              <SkipForward className="mr-2 h-4 w-4" /> Skip for today
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
