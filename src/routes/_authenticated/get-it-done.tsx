import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  GripVertical,
  Pencil,
  RefreshCw,
  Shuffle,
  SkipForward,
  Sparkles,
} from "lucide-react";
import {
  getAllAssignmentsFn,
  getCoursesFn,
  type AssignmentItem,
} from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { CompleteToggle } from "@/components/complete-toggle";
import { cn } from "@/lib/utils";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import {
  useAssignmentMetaMap,
  useSetAssignmentEstimate,
} from "@/hooks/use-assignment-meta";
import { dropStaleOverdue } from "@/lib/assignment-window";
import {
  buildTodayPlan,
  rankGetItDoneAssignments,
  defaultEstimateMinutes,
  type PlanItem,
  type RankedAssignment,
} from "@/lib/get-it-done";
import {
  customToAssignmentItem,
  useCustomAssignments,
} from "@/lib/custom-assignments";
import { useScopedKey } from "@/lib/user-scope";

const GET_IT_DONE_PREFS_KEY = "canvas:get-it-done";

const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
  staleTime: CANVAS_DATA_STALE_MS,
  gcTime: CANVAS_DATA_GC_MS,
});

const coursesQO = queryOptions({
  queryKey: ["canvas", "courses"],
  queryFn: () => getCoursesFn(),
  staleTime: CANVAS_DATA_STALE_MS,
  gcTime: CANVAS_DATA_GC_MS,
});

interface GetItDonePrefs {
  skipped: string[];
  planOrder: string[];
  version: number;
}

const EMPTY_PREFS: GetItDonePrefs = { skipped: [], planOrder: [], version: 1 };

export const Route = createFileRoute("/_authenticated/get-it-done")({
  head: () => ({
    meta: [
      { title: "Get It Done - CanvasPro" },
      {
        name: "description",
        content:
          "A simple CanvasPro plan that recommends the best assignment to start now and builds a realistic plan for today.",
      },
      { property: "og:title", content: "Get It Done - CanvasPro" },
      {
        property: "og:description",
        content:
          "A simple CanvasPro plan that recommends the best assignment to start now and builds a realistic plan for today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GetItDonePage,
});

function useStoredPrefs() {
  const key = useScopedKey(GET_IT_DONE_PREFS_KEY);
  const [prefs, setPrefs] = useState<GetItDonePrefs>(EMPTY_PREFS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      setPrefs(raw ? { ...EMPTY_PREFS, ...(JSON.parse(raw) as Partial<GetItDonePrefs>) } : EMPTY_PREFS);
    } catch {
      setPrefs(EMPTY_PREFS);
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

function dueLabel(dueAt: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!dueAt) return "No due date";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(due);
}

function statusLabel(assignment: AssignmentItem, done: boolean) {
  if (done) return "Complete";
  const submission = assignment.submission;
  if (submission?.missing) return "Missing";
  if (submission?.workflow_state === "graded") return "Graded";
  if (submission?.submitted_at) return submission.late ? "Submitted late" : "Submitted";
  if (assignment.due_at && new Date(assignment.due_at).getTime() < Date.now()) return "Overdue";
  return "Not started";
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

function GetItDonePage() {
  const assignments = useQuery(assignmentsQO);
  const courses = useQuery(coursesQO);
  const custom = useCustomAssignments();
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const metaMap = useAssignmentMetaMap();
  const setEstimate = useSetAssignmentEstimate();
  const [prefs, setPrefs] = useStoredPrefs();
  const [choiceOffset, setChoiceOffset] = useState(0);

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
    return dropStaleOverdue([
      ...(assignments.data ?? []),
      ...custom.list.map((item) => customToAssignmentItem(item, courseById.get(item.course_id))),
    ]);
  }, [assignments.data, custom.list, courseById]);

  const estimates = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const [id, meta] of metaMap.entries()) map.set(id, meta.estimatedMinutes);
    return map;
  }, [metaMap]);

  const skipped = useMemo(() => new Set(prefs.skipped), [prefs.skipped]);
  const ranked = useMemo(
    () =>
      rankGetItDoneAssignments({
        assignments: allAssignments,
        completed: completed.has,
        estimates,
        skipped,
      }),
    [allAssignments, completed.has, estimates, skipped],
  );

  const recommendation = ranked[choiceOffset] ?? ranked[0] ?? null;

  const plan = useMemo(
    () =>
      buildTodayPlan({
        assignments: allAssignments,
        completed: completed.has,
        estimates,
        skipped,
        manualOrder: prefs.planOrder,
      }),
    [allAssignments, completed.has, estimates, skipped, prefs.planOrder],
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
    setPrefs({ ...EMPTY_PREFS, version: Date.now() });
  }

  function movePlanItem(id: number, direction: -1 | 1) {
    const ids = plan.map((item) => String(item.assignment.id));
    const index = ids.indexOf(String(id));
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setPrefs((current) => ({ ...current, planOrder: next }));
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header />
        <GlassCard strong>
          <div className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-24" />
          </div>
        </GlassCard>
        <GlassCard>
          <div className="space-y-3">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        </GlassCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Header />
        <GlassCard>
          <ErrorState message={error.message} />
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <Header />

      {recommendation ? (
        <RecommendationCard
          item={recommendation}
          completed={completed.has(recommendation.assignment.id)}
          onComplete={() => completed.toggle(recommendation.assignment.id)}
          onSkip={() => skipAssignment(recommendation.assignment.id)}
          onChooseAnother={chooseAnother}
          onStart={() => openAssignment(recommendation.assignment)}
        />
      ) : (
        <GlassCard strong title="What Should I Do Now?">
          <EmptyState
            title="Nothing needs your attention right now."
            message="CanvasPro will recommend a task here when an unfinished Canvas assignment is available."
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </GlassCard>
      )}

      <TodayPlanCard
        plan={plan}
        totalMinutes={totalMinutes}
        completeCount={completeCount}
        completed={completed}
        onStart={openAssignment}
        onSkip={skipAssignment}
        onMove={movePlanItem}
        onRegenerate={regeneratePlan}
        onEstimate={(assignment, minutes) =>
          setEstimate.mutate({ assignmentId: assignment.id, courseId: assignment.course_id, minutes })
        }
        estimatePending={setEstimate.isPending}
      />
    </div>
  );
}

function Header() {
  return (
    <header className="px-1 pt-2">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Get It Done
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Get It Done</h1>
    </header>
  );
}

function RecommendationCard({
  item,
  completed,
  onComplete,
  onSkip,
  onChooseAnother,
  onStart,
}: {
  item: RankedAssignment;
  completed: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onChooseAnother: () => void;
  onStart: () => void;
}) {
  const assignment = item.assignment;
  const estimate = item.estimatedMinutes;

  return (
    <GlassCard
      strong
      title="What Should I Do Now?"
      subtitle="CanvasPro ranked your unfinished assignments by deadline, workload, priority, and nearby due dates."
      className="relative"
      action={
        <div className="glass-inset flex h-9 w-9 items-center justify-center rounded-xl">
          <Sparkles className="h-4 w-4" />
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <CompleteToggle done={completed} onToggle={onComplete} label={assignment.name} />
            <div className="min-w-0">
              <h2
                className={cn(
                  "text-2xl font-semibold tracking-tight text-foreground sm:text-3xl",
                  completed && "line-through opacity-70",
                )}
              >
                {assignment.name}
              </h2>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{displayCourseName(assignment.course_name, assignment.course_code)}</span>
                <span className="opacity-40">·</span>
                <span>{dueLabel(assignment.due_at)}</span>
                {estimate != null && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{formatMinutes(estimate)}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-foreground/85">
            {item.explanation}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <button
            type="button"
            onClick={onStart}
            disabled={!assignment.html_url}
            className="glass-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            Start Now
          </button>
          <button
            type="button"
            onClick={onChooseAnother}
            className="glass-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-glass-border px-4 text-sm font-medium"
          >
            <Shuffle className="h-4 w-4" />
            Choose another
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <SkipForward className="h-4 w-4" />
            Skip today
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function TodayPlanCard({
  plan,
  totalMinutes,
  completeCount,
  completed,
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
  onStart: (assignment: AssignmentItem) => void;
  onSkip: (id: number) => void;
  onMove: (id: number, direction: -1 | 1) => void;
  onRegenerate: () => void;
  onEstimate: (assignment: AssignmentItem, minutes: number | null) => void;
  estimatePending: boolean;
}) {
  const progress = plan.length === 0 ? 0 : Math.round((completeCount / plan.length) * 100);

  return (
    <GlassCard
      title="Today's Plan"
      subtitle="A realistic order for the work CanvasPro thinks you can make progress on today."
      action={
        <button
          type="button"
          onClick={onRegenerate}
          className="glass-hover inline-flex min-h-10 items-center gap-2 rounded-xl border border-glass-border px-3 text-xs font-medium"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerate
        </button>
      }
    >
      {plan.length === 0 ? (
        <EmptyState
          title="No plan needed."
          message="Everything urgent is complete, skipped, or already submitted."
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Remaining workload" value={formatMinutes(totalMinutes)} />
            <Stat label="Plan progress" value={`${progress}%`} />
            <Stat label="Tasks" value={`${completeCount}/${plan.length} complete`} />
          </div>
          <ul className="space-y-2">
            {plan.map((item, index) => (
              <PlanRow
                key={item.assignment.id}
                item={item}
                index={index}
                count={plan.length}
                done={completed.has(item.assignment.id)}
                onToggle={() => completed.toggle(item.assignment.id)}
                onStart={() => onStart(item.assignment)}
                onSkip={() => onSkip(item.assignment.id)}
                onMove={(direction) => onMove(item.assignment.id, direction)}
                onEstimate={(minutes) => onEstimate(item.assignment, minutes)}
                estimatePending={estimatePending}
              />
            ))}
          </ul>
        </>
      )}
    </GlassCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-inset p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function PlanRow({
  item,
  index,
  count,
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
        "glass-inset grid gap-3 p-3 transition-opacity sm:grid-cols-[auto_minmax(0,1fr)_auto]",
        done && "opacity-60",
      )}
    >
      <div className="hidden items-center gap-2 sm:flex">
        <GripVertical className="h-4 w-4 text-muted-foreground/70" />
        <span className="text-sm tabular-nums text-muted-foreground">{index + 1}</span>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-3">
          <CompleteToggle done={done} onToggle={onToggle} label={assignment.name} />
          <div className="min-w-0">
            <p className={cn("truncate text-sm font-medium", done && "line-through")}>
              {assignment.name}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{displayCourseName(assignment.course_name, assignment.course_code)}</span>
              <span className="opacity-40">·</span>
              <span>{dueLabel(assignment.due_at)}</span>
              <span className="opacity-40">·</span>
              <span>{statusLabel(assignment, done)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              step={5}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              className="h-9 w-20 rounded-lg border border-glass-border bg-background/50 px-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              aria-label={`Estimated minutes for ${assignment.name}`}
            />
            <button
              type="button"
              onClick={saveEstimate}
              disabled={estimatePending}
              className="glass-hover h-9 rounded-lg border border-glass-border px-3 text-xs font-medium disabled:opacity-50"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="glass-hover inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-glass-border px-2.5 text-xs font-medium"
          >
            <Pencil className="h-3.5 w-3.5" />
            {formatMinutes(item.estimatedMinutes ?? defaultEstimateMinutes(assignment))}
          </button>
        )}

        <div className="flex items-center gap-1">
          <IconButton
            label={`Move ${assignment.name} earlier`}
            onClick={() => onMove(-1)}
            disabled={index === 0}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label={`Move ${assignment.name} later`}
            onClick={() => onMove(1)}
            disabled={index === count - 1}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label={`Start ${assignment.name}`} onClick={onStart}>
            <ExternalLink className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label={`Skip ${assignment.name}`} onClick={onSkip}>
            <SkipForward className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="glass-hover flex h-9 w-9 items-center justify-center rounded-lg border border-glass-border text-muted-foreground transition hover:text-foreground disabled:opacity-35"
    >
      {children}
    </button>
  );
}
