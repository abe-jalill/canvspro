import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { getAllAssignmentsFn, getCoursesFn, type AssignmentItem } from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { GlassCard, Skeleton, ErrorState } from "@/components/glass-card";
import { Segmented } from "@/components/segmented";
import { cn } from "@/lib/utils";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { getCountdown, urgencyAccentClass, urgencyTextClass } from "@/lib/countdown";
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
          "Your overdue work and everything due within the next day, two days, three days, or week, grouped by class.",
      },
      { property: "og:title", content: "Focus — CanvasPro" },
      {
        property: "og:description",
        content:
          "Your overdue work and everything due within the next day, two days, three days, or week, grouped by class.",
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

function FocusPage() {
  const navigate = useNavigate();
  const { window: win } = Route.useSearch();
  const assignments = useQuery(assignmentsQO);
  const courses = useQuery(coursesQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const custom = useCustomAssignments();
  const [showCompleted, setShowCompleted] = useState(false);
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
  const completedInWindow = dueInWindow.filter((a) =>
    isAssignmentComplete(a, completed.has(a.id)),
  );
  const unfinished = dueInWindow.filter((a) =>
    isAssignmentVisible(a, completed.has(a.id), false, now),
  );
  const hiddenCompleteCount = completedInWindow.length;
  const inWindow = showCompleted ? [...unfinished, ...completedInWindow] : unfinished;

  function toggleComplete(assignment: AssignmentItem) {
    const wasComplete = completed.has(assignment.id);
    completed.toggle(assignment.id);
    if (!wasComplete)
      toast.success("Marked complete", {
        description: assignment.name,
        action: { label: "Undo", onClick: () => completed.remove(assignment.id) },
      });
  }

  type Group = { id: number; name: string; code: string; items: AssignmentItem[] };
  const groupMap = new Map<number, Group>();
  (courses.data ?? []).forEach((c) => {
    groupMap.set(c.id, {
      id: c.id,
      name: c.name,
      code: c.course_code ?? "",
      items: [],
    });
  });
  inWindow.forEach((a) => {
    const g = groupMap.get(a.course_id) ?? {
      id: a.course_id,
      name: a.course_name,
      code: a.course_code ?? "",
      items: [],
    };
    g.items.push(a);
    groupMap.set(a.course_id, g);
  });
  const groups = Array.from(groupMap.values())
    .filter((g) => g.items.length > 0)
    .sort((a, b) =>
      displayCourseName(a.name, a.code).localeCompare(displayCourseName(b.name, b.code)),
    );
  groups.forEach((g) => {
    g.items.sort(
      (a, b) =>
        (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity),
    );
  });

  const remaining = unfinished.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 pt-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Focus
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {win === "all"
              ? "All assignments"
              : win === "overdue"
                ? "Overdue assignments"
                : `Due within ${WINDOW_LABELS[win]}`}
          </h1>
        </div>
        <Segmented<FocusWindow>
          value={win}
          onChange={(window) => void navigate({ to: "/focus", search: { window }, replace: true })}
          className="max-w-full overflow-x-auto"
          options={[
            { id: "all", label: "All dates" },
            { id: "7", label: "1 week" },
            { id: "overdue", label: "Overdue" },
            { id: "3", label: "3 days" },
            { id: "2", label: "2 days" },
            { id: "1", label: "1 day" },
          ]}
        />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
        <span>
          {hiddenCompleteCount > 0
            ? `${hiddenCompleteCount} completed or submitted in this window`
            : "Showing unfinished assignments"}
        </span>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(event) => setShowCompleted(event.target.checked)}
          />
          Show completed
        </label>
      </div>

      {assignments.isLoading || courses.isLoading || completed.isLoading || custom.isLoading ? (
        <div className="space-y-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <GlassCard key={i}>
              <div className="mb-3 flex items-baseline justify-between px-1">
                <SkeletonBlock className="h-5 w-40 sm:w-56" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
              <div className="space-y-2">
                <AssignmentRowSkeleton index={i * 2} />
                <AssignmentRowSkeleton index={i * 2 + 1} />
              </div>
            </GlassCard>
          ))}
        </div>
      ) : assignments.isError ? (
        <GlassCard>
          <ErrorState message={(assignments.error as Error).message} />
        </GlassCard>
      ) : groups.length === 0 ? (
        <GlassCard>
          <div className="glass-hover flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
            <div className="glass-inset flex h-12 w-12 items-center justify-center rounded-2xl">
              <Check className="h-6 w-6" />
            </div>
            <p className="text-lg font-semibold tracking-tight">
              {win === "all"
                ? "No assignments to show."
                : win === "overdue"
                  ? "You're all caught up."
                  : win === "1"
                    ? "You're clear for the next 24 hours."
                    : `You're clear for the next ${WINDOW_LABELS[win]}.`}
            </p>
            <p className="text-sm text-muted-foreground">
              {hiddenCompleteCount > 0 && !showCompleted
                ? "Turn on Show completed to review them or undo a CanvasPro completion."
                : win === "all"
                  ? "Refresh Canvas data to check for new assignments."
                  : "No assignments match this view. Choose All dates to check other deadlines."}
            </p>
          </div>
        </GlassCard>
      ) : (
        <>
          <div className="px-1 text-xs text-muted-foreground">
            {remaining} remaining across {groups.length} {groups.length === 1 ? "class" : "classes"}
          </div>
          <div className="space-y-5">
            {groups.map((g) => {
              const total = g.items.reduce((s, a) => s + (a.points_possible ?? 0), 0);
              return (
                <GlassCard key={g.id}>
                  <div className="mb-3 flex items-baseline justify-between px-1">
                    <h2 className="text-base font-semibold tracking-tight">
                      {displayCourseName(g.name, g.code)}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {g.items.length} {g.items.length === 1 ? "item" : "items"} ·{" "}
                      {Math.round(total)} pt
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {g.items.map((a) => {
                      const done = isAssignmentComplete(a, completed.has(a.id));
                      const cd = getCountdown(a.due_at, { completed: done });
                      const canvasDone = isAssignmentComplete(a, false);
                      return (
                        <li
                          key={a.id}
                          className={cn(
                            "glass-inset glass-hover flex items-center justify-between gap-3 p-3 transition-all duration-300",
                            cd && urgencyAccentClass(cd.urgency),
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <button
                              onClick={() => toggleComplete(a)}
                              disabled={!completed.ready || canvasDone}
                              aria-label={`Mark ${a.name} ${done ? "incomplete" : "complete"}`}
                              aria-pressed={done}
                              className="group flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-foreground/30 transition-colors hover:border-foreground/60"
                            >
                              <Check
                                className={cn(
                                  "h-3.5 w-3.5 transition-opacity group-hover:opacity-100",
                                  done ? "opacity-100" : "opacity-0",
                                )}
                                aria-hidden="true"
                              />
                            </button>
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "truncate text-sm font-medium",
                                  done && "line-through opacity-60",
                                )}
                              >
                                {a.name}
                              </p>
                              {done && (
                                <p className="text-xs text-muted-foreground">
                                  {canvasDone
                                    ? "Completed in Canvas"
                                    : "Marked complete in CanvasPro"}
                                </p>
                              )}
                              {!done && a.submission?.missing && (
                                <p className="text-xs text-rose-400">Missing in Canvas</p>
                              )}
                              <AssignmentDescriptionLink
                                assignmentId={a.id}
                                className="mt-1 mr-3"
                              />
                              {a.html_url && (
                                <a
                                  href={a.html_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Open in Canvas <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {a.points_possible != null && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {a.points_possible} pt
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={cn(
                                "whitespace-nowrap text-sm tabular-nums",
                                cd ? urgencyTextClass(cd.urgency) : "text-muted-foreground",
                              )}
                            >
                              {cd ? cd.label : "No due date"}
                            </p>
                            {cd && (
                              <p className="mt-0.5 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground/80">
                                {cd.fullDate}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
