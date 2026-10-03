import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, ChevronDown, ExternalLink } from "lucide-react";
import { getAllAssignmentsFn, getCoursesFn, type AssignmentItem } from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/glass-card";
import { PageTabs } from "@/components/page-tabs";
import { TODAY_TABS } from "@/lib/page-tab-sets";
import { cn } from "@/lib/utils";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { defaultEstimateMinutes } from "@/lib/get-it-done";
import { useAssignmentMetaMap } from "@/hooks/use-assignment-meta";
import { normalizeFocusWindow, isDueInFocusWindow, type FocusWindow } from "@/lib/focus-window";
import {
  isAssignmentComplete,
  isAssignmentVisible,
  isInDisplayWindow,
} from "@/lib/assignment-window";
import { customToAssignmentItem, useCustomAssignments } from "@/lib/custom-assignments";
import { toast } from "sonner";

import {
  coursesQueryOptions as coursesQO,
  assignmentsQueryOptions as assignmentsQO,
} from "@/lib/canvas.queries";
import { SkeletonBlock } from "@/components/skeletons/dashboard-skeletons";

export const Route = createFileRoute("/_authenticated/focus")({
  head: () => ({
    meta: [
      { title: "Focus — CanvasPro" },
      {
        name: "description",
        content: "Everything due soon, laid out day by day or class by class.",
      },
      { property: "og:title", content: "Focus — CanvasPro" },
      {
        property: "og:description",
        content: "Everything due soon, laid out day by day or class by class.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { window: FocusWindow } => ({
    window: normalizeFocusWindow(search.window),
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
  all: "Next 4 weeks",
  "1": "Next 24 hours",
  "2": "Next 2 days",
  "3": "Next 3 days",
  "7": "Next 7 days",
  overdue: "Overdue",
};

const WINDOW_CHOICES: FocusWindow[] = ["overdue", "1", "3", "7", "all"];

type ViewMode = "day" | "class";
const VIEW_KEY = "canvas:focus-view";
const DAY_MS = 24 * 60 * 60 * 1000;

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
  const completedInWindow = dueInWindow.filter(
    (a) => isAssignmentComplete(a, completed.has(a.id)) && isInDisplayWindow(a, now),
  );
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

  const minutesNeeded = unfinished.reduce((s, a) => s + estimateFor(a), 0);

  // Seven days starting today, for the quick day picker.
  const today = startOfDay(now);
  const strip = Array.from({ length: 7 }, (_, i) => {
    const start = today + i * DAY_MS;
    const count = allAssignments.filter((a) => {
      if (!a.due_at || !isAssignmentVisible(a, completed.has(a.id), false, now)) return false;
      const t = Date.parse(a.due_at);
      return t >= start && t < start + DAY_MS;
    }).length;
    return { start, count };
  });

  // Picking a day narrows the list below to that day; picking it again clears it.
  const listItems =
    selectedDay == null
      ? inWindow
      : inWindow.filter((a) => a.due_at && startOfDay(Date.parse(a.due_at)) === selectedDay);

  const loading =
    assignments.isLoading || courses.isLoading || completed.isLoading || custom.isLoading;

  const summary =
    unfinished.length === 0
      ? null
      : win === "overdue"
        ? `${unfinished.length} overdue, about ${formatMinutes(minutesNeeded)} of work`
        : `${unfinished.length} ${unfinished.length === 1 ? "thing" : "things"} due, about ${formatMinutes(minutesNeeded)} of work`;

  const rowProps = (a: AssignmentItem) => ({
    assignment: a,
    course: courseName(a),
    estimate: estimateFor(a),
    done: isAssignmentComplete(a, completed.has(a.id)),
    canvasDone: isAssignmentComplete(a, false),
    ready: completed.ready,
    onToggle: () => toggleComplete(a),
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">
      <PageTabs tabs={TODAY_TABS} label="Today sections" />
      <header className="premium-reveal px-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">Coming up</h1>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Time range: ${WINDOW_LABELS[win]}`}
              className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/30 data-[state=open]:border-foreground/30 data-[state=open]:text-foreground"
            >
              {WINDOW_LABELS[win]}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              <DropdownMenuRadioGroup
                value={win}
                onValueChange={(value) =>
                  void navigate({
                    to: "/focus",
                    search: { window: normalizeFocusWindow(value) },
                    replace: true,
                  })
                }
              >
                {(WINDOW_CHOICES.includes(win) ? WINDOW_CHOICES : [...WINDOW_CHOICES, win]).map(
                  (id) => (
                    <DropdownMenuRadioItem key={id} value={id}>
                      {WINDOW_LABELS[id]}
                    </DropdownMenuRadioItem>
                  ),
                )}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {summary && <p className="mt-1.5 text-sm text-muted-foreground">{summary}</p>}
      </header>

      {loading ? (
        <div className="space-y-5 px-1" role="status" aria-label="Loading your work">
          <SkeletonBlock className="h-14 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : assignments.isError ? (
        <ErrorState message={(assignments.error as Error).message} />
      ) : (
        <>
          {win !== "overdue" && (
            <ol className="premium-reveal grid grid-cols-7 gap-1 px-1" aria-label="Pick a day">
              {strip.map((day, i) => {
                const picked = selectedDay === day.start;
                return (
                  <li key={day.start}>
                    <button
                      type="button"
                      onClick={() => setSelectedDay(picked ? null : day.start)}
                      aria-pressed={picked}
                      aria-label={`${dayHeading(day.start, today)}: ${day.count} due`}
                      className={cn(
                        "flex w-full flex-col items-center gap-0.5 rounded-lg border px-1 py-2.5 text-xs transition-colors duration-300 motion-reduce:transition-none",
                        picked
                          ? "border-foreground/60 text-foreground"
                          : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                      )}
                    >
                      <span>
                        {i === 0
                          ? "Today"
                          : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day.start)}
                      </span>
                      <span className="text-base font-normal tabular-nums text-foreground">
                        {new Date(day.start).getDate()}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 h-1 w-1 rounded-full bg-foreground/50",
                          day.count === 0 && "opacity-0",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
            <div className="inline-flex gap-2" role="group" aria-label="Group by">
              {(
                [
                  ["day", "By day"],
                  ["class", "By class"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-pressed={view === id}
                  className={cn(
                    "rounded-lg border px-3 py-1 transition-colors",
                    view === id
                      ? "border-foreground/60 text-foreground"
                      : "border-foreground/15 hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(event) => setShowCompleted(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Show finished{hiddenCompleteCount > 0 ? ` (${hiddenCompleteCount})` : ""}
            </label>
          </div>

          {listItems.length === 0 ? (
            <div className="px-1 py-16 text-center">
              <Check className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-base">
                {selectedDay != null
                  ? "Nothing due this day."
                  : win === "overdue"
                    ? "Nothing overdue."
                    : "You're all clear."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedDay != null
                  ? "Pick another day, or tap this one again to see everything."
                  : hiddenCompleteCount > 0
                    ? `${hiddenCompleteCount} finished here. Nice work.`
                    : "Pick a longer range above to look further ahead."}
              </p>
            </div>
          ) : view === "day" ? (
            <div className="space-y-8 px-1">
              {groupByDay(listItems, today).map((group) => (
                <section key={group.key}>
                  <h2 className="text-sm text-muted-foreground">
                    {group.label}
                    {group.date && <span className="ml-2 opacity-70">{group.date}</span>}
                  </h2>
                  <ul className="mt-2 space-y-2">
                    {group.items.map((a) => (
                      <FocusRow key={a.id} {...rowProps(a)} showCourse />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-8 px-1">
              {groupByClass(listItems).map((group) => (
                <section key={group.courseId}>
                  <h2 className="text-sm text-muted-foreground">{courseName(group.items[0])}</h2>
                  <ul className="mt-2 space-y-2">
                    {group.items.map((a) => (
                      <FocusRow key={a.id} {...rowProps(a)} showDate />
                    ))}
                  </ul>
                </section>
              ))}
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

function FocusRow({
  assignment: a,
  course,
  estimate,
  done,
  canvasDone,
  ready,
  onToggle,
  showCourse = false,
  showDate = false,
}: {
  assignment: AssignmentItem;
  course: string;
  estimate: number;
  done: boolean;
  canvasDone: boolean;
  ready: boolean;
  onToggle: () => void;
  showCourse?: boolean;
  showDate?: boolean;
}) {
  const due = a.due_at ? Date.parse(a.due_at) : null;
  const time =
    due != null
      ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(due)
      : null;
  const date =
    due != null && showDate
      ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(due)
      : null;
  const missing = !done && a.submission?.missing;

  return (
    <li
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3.5 rounded-lg border border-foreground/15 px-4 py-3.5",
        done && "opacity-55",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!ready || canvasDone}
        aria-label={`Mark ${a.name} ${done ? "incomplete" : "complete"}`}
        aria-pressed={done}
        className="group/check mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground/30 transition-colors hover:border-foreground/60 disabled:cursor-default"
      >
        <Check
          className={cn(
            "h-3 w-3 transition-opacity group-hover/check:opacity-100",
            done ? "opacity-100" : "opacity-0",
          )}
          aria-hidden="true"
        />
      </button>
      <div className="min-w-0">
        <p className={cn("text-[15px] leading-snug", done && "line-through")}>{a.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {showCourse && <span>{course} · </span>}
          <span>about {formatMinutes(estimate)}</span>
          {done && <span> · {canvasDone ? "Done in Canvas" : "Marked done"}</span>}
          {missing && <span> · Missing</span>}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
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
      <p className="whitespace-nowrap pt-0.5 text-right text-xs tabular-nums text-muted-foreground">
        {date ? `${date}${time ? ` · ${time}` : ""}` : (time ?? "No due date")}
      </p>
    </li>
  );
}
