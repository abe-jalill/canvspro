import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { getAllAssignmentsFn, getCoursesFn, type AssignmentItem } from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { GlassCard, Skeleton, ErrorState } from "@/components/glass-card";
import { Segmented } from "@/components/segmented";
import { cn } from "@/lib/utils";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { getCountdown, urgencyAccentClass, urgencyTextClass } from "@/lib/countdown";
import { isFocusWindow, isInFocusWindow, type FocusWindow } from "@/lib/focus-window";

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
  component: FocusPage,
});

const WINDOW_LABELS: Record<FocusWindow, string> = {
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const inWindow = (assignments.data ?? []).filter((a) =>
    isInFocusWindow(a, win, now, completed.has(a.id)),
  );

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
      (a, b) => new Date(a.due_at as string).getTime() - new Date(b.due_at as string).getTime(),
    );
  });

  const remaining = inWindow.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 pt-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Focus
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {win === "overdue" ? "Overdue assignments" : `Due within ${WINDOW_LABELS[win]}`}
          </h1>
        </div>
        <Segmented<FocusWindow>
          value={win}
          onChange={(window) =>
            void navigate({ to: "/focus", search: { window }, replace: true })
          }
          className="max-w-full overflow-x-auto"
          options={[
            { id: "7", label: "1 week" },
            { id: "overdue", label: "Overdue" },
            { id: "3", label: "3 days" },
            { id: "2", label: "2 days" },
            { id: "1", label: "1 day" },
          ]}
        />
      </header>

      {assignments.isLoading || courses.isLoading ? (
        <GlassCard>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </GlassCard>
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
              {win === "overdue"
                ? "You're all caught up."
                : win === "1"
                  ? "You're clear for the next 24 hours."
                : `You're clear for the next ${WINDOW_LABELS[win]}.`}
            </p>
            <p className="text-sm text-muted-foreground">No unfinished assignments in this window.</p>
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
                      const cd = getCountdown(a.due_at);
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
                              onClick={() => completed.add(a.id)}
                              aria-label={`Mark ${a.name} complete`}
                              className="group flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-foreground/30 transition-colors hover:border-foreground/60"
                            >
                              <Check
                                className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                                aria-hidden="true"
                              />
                            </button>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{a.name}</p>
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
                              {cd ? cd.label : "—"}
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
