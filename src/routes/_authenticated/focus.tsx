import { AssignmentEstimateEditor } from "@/components/assignment-estimate";
import { formatAssignmentDue, relativeDueDay } from "@/lib/assignment-due";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { getAllAssignmentsFn, getCoursesFn, type AssignmentItem } from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { ErrorState } from "@/components/glass-card";
import { PageTabs } from "@/components/page-tabs";
import { TODAY_TABS } from "@/lib/page-tab-sets";
import { cn } from "@/lib/utils";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { defaultEstimateMinutes } from "@/lib/get-it-done";
import { useAssignmentMetaMap } from "@/hooks/use-assignment-meta";
import {
  normalizeFocusWindow,
  isDueInFocusWindow,
  isDueOnDay,
  isInFocusWindow,
  type FocusWindow,
} from "@/lib/focus-window";
import {
  isAssignmentComplete,
  isAssignmentVisible,
  isInDisplayWindow,
} from "@/lib/assignment-window";
import { customToAssignmentItem, useCustomAssignments } from "@/lib/custom-assignments";
import { useCompletionExit } from "@/lib/completion-motion";
import { CompletedLink } from "@/components/completed-link";

import {
  coursesQueryOptions as coursesQO,
  assignmentsQueryOptions as assignmentsQO,
} from "@/lib/canvas.queries";
import { SkeletonBlock } from "@/components/skeletons/dashboard-skeletons";

export const Route = createFileRoute("/_authenticated/focus")({
  head: () => ({
    meta: [
      { title: "Focus — CoursePro" },
      {
        name: "description",
        content: "Everything due soon, laid out day by day or class by class.",
      },
      { property: "og:title", content: "Focus — CoursePro" },
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

/**
 * Coming Up has one row of choices and exactly one is picked: Overdue, This
 * week, a single day, or Next 4 weeks. Links can still ask for the old
 * ranges: 24 hours opens Today, 2 or 3 days open This week.
 */
type RangeChoice = "overdue" | "7" | "all";
const RANGE_LABELS: Record<RangeChoice, string> = {
  overdue: "Overdue",
  "7": "This week",
  all: "Next 4 weeks",
};

function rangeChoiceFor(win: FocusWindow): RangeChoice {
  return win === "overdue" ? "overdue" : win === "all" ? "all" : "7";
}

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

/** "today", "tomorrow" or "on Wednesday", for the summary line. */
function dueDayPhrase(dayStart: number, today: number) {
  const heading = dayHeading(dayStart, today);
  return heading === "Today" || heading === "Tomorrow" ? heading.toLowerCase() : `on ${heading}`;
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
  const range = rangeChoiceFor(win);
  // A day tile shows that day only; otherwise the picked range.
  const pickedDay = selectedDay ?? (win === "1" ? startOfDay(now) : null);
  const dueInWindow = allAssignments.filter((a) =>
    pickedDay == null ? isDueInFocusWindow(a, range, now) : isDueOnDay(a, pickedDay),
  );
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

  // Marking done folds the row away and shows the undo bar (see completion-motion).
  const toggleComplete = (assignment: AssignmentItem) => completed.toggle(assignment.id);

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

  const rangeCounts = Object.fromEntries(
    (["overdue", "7", "all"] as const).map((id) => [
      id,
      allAssignments.filter((a) => isInFocusWindow(a, id, now, completed.has(a.id))).length,
    ]),
  ) as Record<RangeChoice, number>;
  const pickRange = (id: RangeChoice) => {
    setSelectedDay(null);
    void navigate({ to: "/focus", search: { window: id }, replace: true });
  };
  const listItems = inWindow;

  const loading =
    assignments.isLoading || courses.isLoading || completed.isLoading || custom.isLoading;

  const summary =
    unfinished.length === 0
      ? null
      : pickedDay != null
        ? `${unfinished.length} ${unfinished.length === 1 ? "thing" : "things"} due ${dueDayPhrase(pickedDay, today)}, about ${formatMinutes(minutesNeeded)} of work`
      : range === "overdue"
        ? `${unfinished.length} overdue, about ${formatMinutes(minutesNeeded)} of work`
        : `${unfinished.length} ${unfinished.length === 1 ? "thing" : "things"} due ${range === "7" ? "this week" : "in the next 4 weeks"}, about ${formatMinutes(minutesNeeded)} of work`;

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
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">To-Do</h1>
          <CompletedLink />
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
          <div
            className="premium-reveal -mx-1 flex snap-x gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)]"
            role="group"
            aria-label="Show"
          >
            {(rangeCounts.overdue > 0 || range === "overdue") && (
              <RangeTile
                label={RANGE_LABELS.overdue}
                count={rangeCounts.overdue}
                picked={pickedDay == null && range === "overdue"}
                onPick={() => pickRange("overdue")}
                warn
              />
            )}
            <RangeTile
              label={RANGE_LABELS["7"]}
              count={rangeCounts["7"]}
              picked={pickedDay == null && range === "7"}
              onPick={() => pickRange("7")}
            />
            {strip.map((day, i) => {
              const picked = pickedDay === day.start;
              return (
                <button
                  key={day.start}
                  type="button"
                  onClick={() => setSelectedDay(day.start)}
                  aria-pressed={picked}
                  aria-label={`${dayHeading(day.start, today)}: ${day.count} due`}
                  className={cn(
                    "flex min-w-[3.6rem] flex-1 snap-start flex-col items-center gap-0.5 rounded-lg border px-1 py-2.5 text-xs transition-colors duration-300 motion-reduce:transition-none",
                    picked
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  <span>
                    {i === 0
                      ? "Today"
                      : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day.start)}
                  </span>
                  <span className={cn("text-base font-normal tabular-nums", picked ? "text-background" : "text-foreground")}>
                    {new Date(day.start).getDate()}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 h-1 w-1 rounded-full",
                      picked ? "bg-background/70" : "bg-foreground/50",
                      day.count === 0 && "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
            <RangeTile
              label={RANGE_LABELS.all}
              count={rangeCounts.all}
              picked={pickedDay == null && range === "all"}
              onPick={() => pickRange("all")}
            />
          </div>

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
                {pickedDay != null
                  ? "Nothing due this day."
                  : range === "overdue"
                    ? "Nothing overdue."
                    : "You're all clear."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hiddenCompleteCount > 0
                  ? `${hiddenCompleteCount} finished here. Nice work.`
                  : pickedDay != null
                    ? "Pick another day above."
                    : range === "7"
                      ? "Pick Next 4 weeks above to look further ahead."
                      : "Nothing else is due."}
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

/** Overdue, This week or Next 4 weeks, with how many are due. */
function RangeTile({
  label,
  count,
  picked,
  onPick,
  warn = false,
}: {
  label: string;
  count: number;
  picked: boolean;
  onPick: () => void;
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      aria-label={`${label}: ${count} due`}
      className={cn(
        "flex min-w-[5.5rem] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2.5 text-xs transition-colors duration-300 motion-reduce:transition-none",
        picked
          ? "border-foreground bg-foreground text-background"
          : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span
        className={cn(
          "text-base font-normal tabular-nums",
          picked ? "text-background" : warn && count > 0 ? "text-rose-300" : "text-foreground",
        )}
      >
        {count}
      </span>
      <span className="mt-0.5 h-1 w-1" aria-hidden="true" />
    </button>
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
        date = relativeDueDay(a.due_at) ? null : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(start);
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
  done: savedDone,
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
      ? formatAssignmentDue(a.due_at, Date.now(), false)
      : null;
  const exit = useCompletionExit<HTMLLIElement>(a.id);
  // Playing its completion exit: shown done until it folds away.
  const done = savedDone || exit.completing;
  const missing = !done && a.submission?.missing;

  return (
    <li
      ref={exit.ref}
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3.5 rounded-lg border border-foreground/15 px-4 py-3.5",
        done && "opacity-55",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!ready}
        aria-label={`Mark ${a.name} ${done ? "incomplete" : "complete"}`}
        aria-pressed={done}
        data-completing={exit.completing || undefined}
        className={cn(
          "group/check mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground/30 transition-colors hover:border-foreground/60 disabled:cursor-default",
          exit.completing && "border-foreground/70 bg-foreground text-background",
        )}
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

          {done && <span> · {canvasDone ? "Done in Canvas" : "Marked done"}</span>}
          {missing && <span> · Missing</span>}
        </p>
        <AssignmentEstimateEditor assignment={a} className="mt-2" />
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
        {date ? `${date}${time ? ` · ${time}` : ""}` : relativeDueDay(a.due_at) ? formatAssignmentDue(a.due_at) : (time ?? "No due date")}
      </p>
    </li>
  );
}
