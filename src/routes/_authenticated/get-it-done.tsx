import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileText,
  ExternalLink,
  MoreHorizontal,
  Shuffle,
  SkipForward,
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
import { ErrorState } from "@/components/glass-card";
import { CompleteToggle } from "@/components/complete-toggle";
import { PageTabs } from "@/components/page-tabs";
import { TODAY_TABS } from "@/lib/page-tab-sets";
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
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Header />
        {/* Keep the final layout while Canvas data loads so the page never jumps. */}
        <div className="space-y-3 px-1 pt-2" role="status" aria-label="Loading your plan">
          <SkeletonBlock className="h-7 w-2/3" />
          <SkeletonBlock className="h-4 w-1/3" />
          <SkeletonBlock className="mt-4 h-11 w-32 rounded-full" />
        </div>
        <div className="space-y-4 px-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <SkeletonBlock className="h-4 w-44 sm:w-60" />
              <SkeletonBlock className="h-3 w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Header />
        <ErrorState message={error.message} />
      </div>
    );
  }

  const remainingMinutes = plan
    .filter((item) => !completed.has(item.assignment.id))
    .reduce((sum, item) => sum + item.plannedMinutes, 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-24 md:pb-8">
      <Header
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
        <div className="px-1 py-12 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-base">You're all clear.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {allAssignments.length === 0
              ? "Canvas didn't return any assignments. Refresh Canvas data or check your Canvas connection in Settings."
              : visibleAssignments.length === 0
                ? `Nothing is due in the next ${prefs.windowDays === "7" ? "week" : "two weeks"}.`
                : "Everything due in this window is done or skipped for today."}
          </p>
        </div>
      )}

      <TodayPlanCard
        plan={plan}
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

      <LookingAhead windowDays={prefs.windowDays} onChange={setWindowDays} />
    </div>
  );
}

function Header({ summary }: { summary?: string }) {
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  return (
    <>
      <PageTabs tabs={TODAY_TABS} label="Today sections" />
      <header className="premium-reveal px-1">
        <p className="text-sm text-muted-foreground">{today}</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight md:text-4xl">Up next</h1>
        {summary && <p className="mt-1.5 text-sm text-muted-foreground">{summary}</p>}
      </header>
    </>
  );
}

/** A quiet footer link instead of a control in the header. */
function LookingAhead({
  windowDays,
  onChange,
}: {
  windowDays: AssignmentWindow;
  onChange: (days: AssignmentWindow) => void;
}) {
  const two = windowDays === "14";
  return (
    <p className="px-1 text-sm text-muted-foreground">
      Showing the next {two ? "two weeks" : "week"}.{" "}
      <button
        type="button"
        onClick={() => onChange(two ? "7" : "14")}
        className="underline decoration-foreground/25 underline-offset-2 transition-colors hover:text-foreground"
      >
        {two ? "Show one week" : "Show two weeks"}
      </button>
    </p>
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
    <section className="premium-reveal min-w-0 rounded-lg border border-foreground/15 p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <CompleteToggle
          done={completed}
          onToggle={onComplete}
          label={assignment.name}
          className="mt-2"
        />
        <div className="min-w-0 flex-1">
          <h2
            title={item.explanation}
            className={cn(
              "text-balance text-2xl font-normal tracking-tight text-foreground sm:text-[1.7rem] sm:leading-snug",
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
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More options for this suggestion"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
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

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 sm:pl-9">
        <Link
          to="/study-session"
          search={{ assignment: assignment.id }}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-foreground px-7 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Start
        </Link>
        {assignment.html_url && (
          <a
            href={assignment.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Open in Canvas
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <AssignmentDescriptionLink assignmentId={assignment.id} />
      </div>
    </section>
  );
}

function TodayPlanCard({
  plan,
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
  completed: ReturnType<typeof useLocalSet>;
  upNextId: number | null;
  onStart: (assignment: AssignmentItem) => void;
  onSkip: (id: number) => void;
  onMove: (id: number, direction: -1 | 1) => void;
  onRegenerate: () => void;
  onEstimate: (assignment: AssignmentItem, minutes: number | null) => void;
  estimatePending: boolean;
}) {
  // The suggestion above is already the first thing on the plan, so the list
  // only shows what comes after it.
  const rest = plan.filter((item) => item.assignment.id !== upNextId);

  return (
    <section className="premium-reveal min-w-0 px-1" style={{ animationDelay: "60ms" }}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm text-muted-foreground">The rest of today</h2>
        <button
          type="button"
          onClick={onRegenerate}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="Rebuild the plan and bring back skipped work"
        >
          Reset plan
        </button>
      </header>

      {rest.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          {plan.length === 0
            ? "Nothing scheduled for today."
            : "That's everything planned for today."}
        </p>
      ) : (
        <ol className="mt-2 space-y-2">
          {plan.map((item, index) =>
            item.assignment.id === upNextId ? null : (
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
            ),
          )}
        </ol>
      )}
    </section>
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
        "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3.5 rounded-lg border border-foreground/15 px-4 py-3.5",
        done && "opacity-55",
      )}
    >
      <CompleteToggle done={done} onToggle={onToggle} label={assignment.name} className="mt-0.5" />

      <div className="min-w-0">
        <p className={cn("text-[15px] leading-snug", done && "line-through")}>{assignment.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {displayCourseName(assignment.course_name, assignment.course_code)}
          <span className="mx-1.5 opacity-40">·</span>
          {dueLabel(assignment.due_at)}
          {tag && <span> · {tag.toLowerCase()}</span>}
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
            className="inline-flex h-8 items-center rounded-lg px-2 text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground"
          >
            {formatMinutes(item.estimatedMinutes ?? defaultEstimateMinutes(assignment))}
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`More options for ${assignment.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-[opacity,background-color] hover:bg-foreground/[0.06] hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
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
              <Link
                to="/courses/$courseId"
                params={{ courseId: String(assignment.course_id) }}
                search={{ assignment: String(assignment.id) }}
              >
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
