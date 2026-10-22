import { TaskDestination } from "@/components/task-destination";
import { formatAssignmentDue } from "@/lib/assignment-due";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Check, Keyboard, ListChecks, Play, Search, Star, X } from "lucide-react";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { ErrorState } from "@/components/glass-card";
import { cn } from "@/lib/utils";
import { AssignmentProgressBar } from "@/components/assignment-progress";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { defaultEstimateMinutes } from "@/lib/get-it-done";
import { useAssignmentMetaMap, useAssignmentMeta } from "@/hooks/use-assignment-meta";
import {
  normalizeFocusWindow,
  type FocusWindow,
} from "@/lib/focus-window";
import { isAssignmentComplete } from "@/lib/assignment-window";
import {
  customToAssignmentItem,
  isCustomAssignmentId,
  NO_CLASS_ID,
  useCustomAssignments,
} from "@/lib/custom-assignments";
import { useCompletionExit } from "@/lib/completion-motion";
import { CompletedLink } from "@/components/completed-link";
import { classColor } from "@/lib/class-color";
import { formatMinutes } from "@/lib/format-minutes";

import {
  coursesQueryOptions as coursesQO,
  assignmentsQueryOptions as assignmentsQO,
} from "@/lib/canvas.queries";
import { SkeletonBlock } from "@/components/skeletons/dashboard-skeletons";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { OpensLabel } from "@/components/assignment-description-link";
import { AddTaskButton } from "@/components/add-task-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TodoWeekPicker } from "@/components/todo-week-picker";
import { StepList } from "@/components/todo/step-list";
import { QuickAdd } from "@/components/todo/quick-add";
import { WeeklyRhythm } from "@/components/todo/weekly-rhythm";
import { useAssignmentSteps } from "@/hooks/use-assignment-steps";
import { isBigWork, nextStep, stepsPercent } from "@/lib/assignment-steps";
import { courseAliases } from "@/lib/quick-add";
import {
  impactLabel,
  isHighImpact,
  leftTodayLabel,
  pointsShare,
  rhythmWeek,
  RHYTHM_KEY,
  todayProgress,
} from "@/lib/todo-insights";
import { completionRecords } from "@/lib/completion-records";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { nicknameForCourseId } from "@/lib/course-display";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startOfLocalDay, tasksForDay, todoWeekDays } from "@/lib/todo-week";
import { weekProgress } from "@/lib/week-progress";

export const Route = createFileRoute("/_authenticated/focus")({
  head: () => ({
    meta: [
      { title: "To-Do — CoursePro" },
      {
        name: "description",
        content: "Tasks due on your selected day, with today selected to start.",
      },
      { property: "og:title", content: "To-Do — CoursePro" },
      {
        property: "og:description",
        content: "Tasks due on your selected day, with today selected to start.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // Old links can still say ?window=…; To-Do is one list now, so it's not needed.
  validateSearch: (search: Record<string, unknown>): { window?: FocusWindow } =>
    search.window === undefined ? {} : { window: normalizeFocusWindow(search.window) },
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(assignmentsQO);
      void context.queryClient.ensureQueryData(coursesQO);
    }
  },
  component: FocusPage,
});

type ViewMode = "day" | "class" | "impact";
/** Where this browser kept the choice before it synced. */
const VIEW_KEY = "canvas:focus-view";
const TODO_GROUPING_KEY = "todo-grouping";
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** By day or by class, saved to the account (the iPhone's To-Do uses it too). */
function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const saved = useUserPreferenceKey<unknown>(TODO_GROUPING_KEY, null);
  // Before syncing, the choice lived in this browser: carry it over once.
  useEffect(() => {
    if (!saved.ready || saved.value === "day" || saved.value === "class" || saved.value === "impact") return;
    try {
      const old = window.localStorage.getItem(VIEW_KEY);
      if (old === "day" || old === "class") saved.set(old);
    } catch {
      /* the default is fine */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.ready, saved.value]);
  const mode: ViewMode = saved.value === "class" || saved.value === "impact" ? saved.value : "day";
  // Saved at once (shown straight away), and on every other device within moments.
  const update = (next: ViewMode) => saved.set(next);
  return [mode, update];
}

interface Group {
  key: string;
  /** "Today", "Tomorrow", "Sunday", "Catch up", or the class's name. */
  title: string;
  /** "Oct 25" for a day. */
  date: string | null;
  isToday: boolean;
  isCatchUp: boolean;
  courseId: number | null;
  items: AssignmentItem[];
}

/**
 * To-Do opens on today. A Sunday–Saturday picker browses four calendar weeks.
 * Picking a day and searching both narrow the same daily list.
 */
function FocusPage() {
  const assignments = useQuery(assignmentsQO);
  const courses = useQuery(coursesQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const custom = useCustomAssignments(true);
  const meta = useAssignmentMeta();
  const metaMap = useAssignmentMetaMap();
  const [view, setView] = useViewMode();
  const [now, setNow] = useState(() => Date.now());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const selectedDay = selectedDate ?? startOfLocalDay(now);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const steps = useAssignmentSteps();
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());
  const [showKeys, setShowKeys] = useState(false);
  const rhythm = useUserPreferenceKey<unknown>(RHYTHM_KEY, false);
  const preferences = useUserPreferences();
  const toggleSteps = (id: number) =>
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const courseById = new Map((courses.data ?? []).map((course) => [course.id, course]));
  const courseIds = (courses.data ?? []).map((course) => course.id);
  const courseOptions = (courses.data ?? []).map((course) => ({
    id: course.id,
    label: displayCourseName(course.name, course.course_code),
  }));
  const allAssignments = [
    ...(assignments.data ?? []),
    ...custom.list.map((item) => customToAssignmentItem(item, courseById.get(item.course_id))),
  ];
  const courseName = (a: AssignmentItem) => {
    const c = courseById.get(a.course_id);
    return displayCourseName(c?.name ?? a.course_name, c?.course_code ?? a.course_code);
  };
  const estimateFor = (a: AssignmentItem) =>
    metaMap.get(a.id)?.estimatedMinutes ?? defaultEstimateMinutes(a);
  const isDone = (a: AssignmentItem) => isAssignmentComplete(a, completed.has(a.id));

  const text = query.trim().toLowerCase();
  // Search stays within the selected calendar day, including earlier deadlines today.
  const items = tasksForDay(allAssignments, selectedDay, isDone)
    .filter(
      (a) =>
        (!text ||
          a.name.toLowerCase().includes(text) ||
          courseName(a).toLowerCase().includes(text)),
    )
    .sort(byDue);

  const weekDates = todoWeekDays(now, weekOffset);
  const days = weekProgress(allAssignments, isDone, () => true, weekDates[0]);
  const week = allAssignments.filter((a) =>
    a.due_at && weekDates.includes(startOfLocalDay(Date.parse(a.due_at))));
  const weekDone = week.filter(isDone).length;
  const weekLeft = week.filter((a) => !isDone(a));
  const weekTotal = weekDone + weekLeft.length;
  const dayLabel = selectedDay === startOfLocalDay(now) ? "today" :
    new Date(selectedDay).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const isTodaySelected = selectedDay === startOfLocalDay(now);
  // Today: what's left, with a head start for work already in progress.
  const dueToday = allAssignments.filter((a) => a.due_at && startOfLocalDay(Date.parse(a.due_at)) === startOfLocalDay(now));
  const todayDone = todayProgress(
    dueToday.map((a) => ({ done: isDone(a), progress: metaMap.get(a.id)?.progressPercent ?? null, minutes: estimateFor(a) })),
  );
  const headerLine = isTodaySelected
    ? todayDone.total > 0
      ? `${leftTodayLabel(todayDone.left, todayDone.total)}${todayDone.left > 0 ? ` · ${formatMinutes(todayDone.minutesLeft)}` : ""}`
      : "Nothing due today"
    : items.length > 0
      ? `${items.length} due ${dayLabel} · ${formatMinutes(items.reduce((s, a) => s + estimateFor(a), 0))}`
      : `Nothing due ${dayLabel}`;
  const shareOf = (a: AssignmentItem) => pointsShare(a, allAssignments);
  const quickCourses = (courses.data ?? []).map((c) => ({
    id: c.id,
    label: displayCourseName(c.name, c.course_code),
    names: courseAliases(c.name, c.course_code, nicknameForCourseId(c.id)),
  }));
  const rhythmOn = rhythm.value === true;
  const rhythmDays = rhythmWeek(
    Object.values(completionRecords((preferences.data ?? {}) as Record<string, unknown>))
      .filter((r) => r.completed)
      .map((r) => r.completedAt),
    now,
  );

  // Counts only once everything has loaded, never "All clear" before it.
  const loading =
    assignments.isLoading ||
    courses.isLoading ||
    completed.isLoading ||
    custom.isLoading ||
    meta.isLoading;
  // A failed refresh keeps showing what loaded before; only nothing at all is an error.
  const failed = assignments.isError && !assignments.data;
  const today = startOfDay(now);
  const groups =
    view === "class"
      ? groupByClass(items, courseName)
      : view === "impact"
        ? groupByImpact(items, shareOf)
        : groupByDay(items, today, now);

  // Keyboard: j/k move between tasks, x marks done, s starts studying, e opens
  // steps, n quick-adds, / searches, ? lists them all.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-todo-row]") ?? [])];
      const current = rows.findIndex((r) => r.contains(document.activeElement));
      const focusRow = (i: number) => rows[Math.max(0, Math.min(rows.length - 1, i))]?.focus();
      const row = rows[current];
      switch (e.key) {
        case "j": case "ArrowDown":
          if (rows.length) { e.preventDefault(); focusRow(current + 1); }
          break;
        case "k": case "ArrowUp":
          if (rows.length && current >= 0) { e.preventDefault(); focusRow(current - 1); }
          break;
        case "x": row?.querySelector<HTMLElement>("[data-todo-toggle]")?.click(); break;
        case "s": row?.querySelector<HTMLElement>("[data-todo-start]")?.click(); break;
        case "e": row?.querySelector<HTMLElement>("[data-todo-steps]")?.click(); break;
        case "n": e.preventDefault(); quickAddRef.current?.focus(); break;
        case "/": e.preventDefault(); setSearching(true); break;
        case "?": setShowKeys(true); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      <header className="dashboard-today__header relative px-1 pt-1">
        <div className="relative flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">To-Do</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (searching) setQuery("");
                setSearching(!searching);
              }}
              aria-label={searching ? "Close search" : "Search"}
              aria-pressed={searching}
              className="press grid h-9 w-9 place-items-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              {searching ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
            <CompletedLink />
            <AddTaskButton courseOptions={courseOptions} onAdd={custom.add} />
          </div>
        </div>
        <div className="relative mt-2 flex items-center justify-between gap-3">
          {loading ? (
            <span className="skeleton-shimmer block h-4 w-44" aria-hidden="true" />
          ) : failed ? (
            // The error shows below; no count without data.
            <span className="block h-6" aria-hidden="true" />
          ) : (
            <p className="text-base tabular-nums text-muted-foreground">{headerLine}</p>
          )}
          <Select value={view} onValueChange={(value) => setView(value as ViewMode)}>
            <SelectTrigger aria-label="Group" className="w-auto min-h-9 py-1.5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="day">By day</SelectItem>
              <SelectItem value="class">By class</SelectItem>
              <SelectItem value="impact">By impact</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!loading && !failed && isTodaySelected && todayDone.total > 0 && (
          // Today: a close goal, filling as you go (work in progress counts partly).
          <div
            className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10"
            role="progressbar"
            aria-label="Today's progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(todayDone.fraction * 100)}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${Math.round(todayDone.fraction * 100)}%` }}
            />
          </div>
        )}
        {!loading && !failed && weekTotal > 0 && <WeekSegments done={weekDone} total={weekTotal} />}
      </header>

      <TodoWeekPicker days={days} now={now} selectedDay={selectedDay}
        weekOffset={weekOffset} onSelectDay={setSelectedDate}
        onChangeWeek={(offset) => {
          setWeekOffset(offset);
          const dates = todoWeekDays(now, offset);
          setSelectedDate(dates.includes(startOfLocalDay(now)) ? startOfLocalDay(now) : dates[0]);
        }}
        onToday={() => { setWeekOffset(0); setSelectedDate(null); }}
      />

      {searching && (
        <label className="flex items-center gap-3 rounded-xl border border-foreground/15 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assignments or classes"
            aria-label="Search assignments or classes"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      )}

      {!loading && !failed && <QuickAdd ref={quickAddRef} courses={quickCourses} onAdd={custom.add} />}
      {!loading && !failed && rhythmOn && <WeeklyRhythm days={rhythmDays} now={now} />}

      {loading ? (
        <div className="space-y-6 px-1" role="status" aria-label="Loading your work">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-28 w-full" />
            </div>
          ))}
        </div>
      ) : failed ? (
        <ErrorState message={(assignments.error as Error).message} />
      ) : items.length === 0 ? (
        <div className="px-1 py-16 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-500">
            <Check className="h-5 w-5" aria-hidden="true" />
          </span>
          {/* Everything due today finished: say so warmly. */}
          <p className="mt-3 text-base">
            {text
              ? "No matches for this day"
              : isTodaySelected && todayDone.total > 0
                ? "Done for today. Nice work."
                : `Nothing due ${dayLabel}.`}
          </p>
          {!text && isTodaySelected && todayDone.total > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              You finished {todayDone.total} {todayDone.total === 1 ? "thing" : "things"} due today. Rest, or get ahead.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-7" ref={listRef}>
          {groups.map((group) => (
            <section key={group.key}>
              <SectionLabel
                group={group}
                minutes={group.items.reduce((s, a) => s + estimateFor(a), 0)}
                color={group.courseId != null ? classColor(group.courseId, courseIds) : undefined}
              />
              {/* One card per day; today's catches the palette light. */}
              <ul
                className={cn(
                  "mt-2 divide-y divide-foreground/[0.07] rounded-2xl border px-4",
                  group.isToday
                    ? "border-primary/30 bg-gradient-to-b from-primary/10 to-transparent"
                    : "glass-panel border-foreground/10",
                )}
              >
                {group.items.map((a) => (
                  <FocusRow
                    key={a.id}
                    assignment={a}
                    course={courseName(a)}
                    estimate={estimateFor(a)}
                    done={isDone(a)}
                    canvasDone={isAssignmentComplete(a, false)}
                    ready={completed.ready}
                    onToggle={() => completed.toggle(a.id)}
                    color={classColor(a.course_id, courseIds)}
                    showCourse={view !== "class"}
                    share={shareOf(a)}
                    steps={steps}
                    stepsOpen={openSteps.has(a.id)}
                    onToggleSteps={() => toggleSteps(a.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Quiet extras: the optional weekly rhythm and keyboard shortcuts. */}
      {!loading && !failed && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => rhythm.set(!rhythmOn)}
            aria-pressed={rhythmOn}
            disabled={!rhythm.ready}
            className="press inline-flex min-h-9 items-center rounded-lg px-3 hover:text-foreground"
          >
            {rhythmOn ? "Hide weekly rhythm" : "Show weekly rhythm"}
          </button>
          <span aria-hidden="true" className="hidden md:inline">·</span>
          <button
            type="button"
            onClick={() => setShowKeys(true)}
            className="press hidden min-h-9 items-center gap-1.5 rounded-lg px-3 hover:text-foreground md:inline-flex"
          >
            <Keyboard className="h-3.5 w-3.5" aria-hidden="true" /> Keyboard shortcuts
          </button>
        </div>
      )}
      <Dialog open={showKeys} onOpenChange={setShowKeys}>
        <DialogContent className="glass-panel-strong rounded-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>On To-Do, when you're not typing.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {[
              ["j / k", "Next / previous task"],
              ["x", "Mark done (or not done)"],
              ["s", "Start studying it"],
              ["e", "Show its steps"],
              ["n", "Quick add"],
              ["/", "Search"],
              ["?", "This list"],
            ].map(([key, what]) => (
              <div key={key} className="contents">
                <dt><kbd className="rounded-md border border-foreground/20 px-1.5 py-0.5 font-mono text-xs">{key}</kbd></dt>
                <dd className="text-muted-foreground">{what}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Most of the class's points first. */
function groupByImpact(items: AssignmentItem[], share: (a: AssignmentItem) => number | null): Group[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => (share(b) ?? 0) - (share(a) ?? 0) || byDue(a, b));
  return [{ key: "impact", title: "Most impact first", date: null, isToday: false, isCatchUp: false, courseId: null, items: sorted }];
}

/** One segment per assignment due this week; done ones fill from the left. Past 12 it's one bar. */
function WeekSegments({ done, total }: { done: number; total: number }) {
  return (
    <div
      className="relative mt-3 flex gap-1"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={`${done} of ${total} done this week`}
    >
      {total > 12 ? (
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </span>
      ) : (
        Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none",
              index < done ? "bg-primary" : "bg-foreground/10",
            )}
          />
        ))
      )}
    </div>
  );
}

/** "Sunday  Oct 25  2 ····· 1 hr": Today in the palette color, Catch up in rose. */
function SectionLabel({
  group,
  minutes,
  color,
}: {
  group: Group;
  minutes: number;
  color?: string;
}) {
  return (
    <h2 className="flex items-baseline gap-2 px-1">
      {color && (
        <span
          className="inline-block h-2 w-2 shrink-0 -translate-y-px rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          "text-[15px] font-semibold tracking-[-0.01em]",
          group.isToday ? "text-primary" : group.isCatchUp ? "text-rose-400" : "text-foreground",
        )}
      >
        {group.title}
      </span>
      {group.date && <span className="text-sm text-muted-foreground">{group.date}</span>}
      <span className="text-sm tabular-nums text-muted-foreground/70">{group.items.length}</span>
      <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-muted-foreground/70">
        {formatMinutes(minutes)}
      </span>
    </h2>
  );
}

function byDue(a: AssignmentItem, b: AssignmentItem) {
  return (
    (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity)
  );
}

function groupByDay(items: AssignmentItem[], today: number, now: number): Group[] {
  const groups = new Map<string, Group>();
  for (const a of items) {
    const due = a.due_at ? Date.parse(a.due_at) : NaN;
    const base = {
      isToday: false,
      isCatchUp: false,
      courseId: null,
      items: [] as AssignmentItem[],
    };
    let group: Group;
    if (!Number.isFinite(due)) {
      group = { ...base, key: "none", title: "No due date", date: null };
    } else {
      const start = startOfDay(due);
      const diff = Math.round((start - today) / DAY_MS);
      group = {
        ...base,
        key: String(start),
        title:
          diff === 0
            ? "Today"
            : diff === 1
              ? "Tomorrow"
              : new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(start),
        date: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(start),
        isToday: diff === 0,
      };
    }
    const existing = groups.get(group.key) ?? group;
    existing.items.push(a);
    groups.set(group.key, existing);
  }
  return [...groups.values()];
}

function groupByClass(items: AssignmentItem[], courseName: (a: AssignmentItem) => string): Group[] {
  const groups = new Map<number, Group>();
  for (const a of items) {
    const g = groups.get(a.course_id) ?? {
      key: `class-${a.course_id}`,
      title: courseName(a),
      date: null,
      isToday: false,
      isCatchUp: false,
      courseId: a.course_id,
      items: [],
    };
    g.items.push(a);
    groups.set(a.course_id, g);
  }
  // Your own tasks that aren't for a class come after the classes.
  return [...groups.values()].sort(
    (x, y) =>
      Number(x.courseId === NO_CLASS_ID) - Number(y.courseId === NO_CLASS_ID) ||
      x.title.localeCompare(y.title),
  );
}

/** The name, and one quiet line: class, time and how long it takes. */
function FocusRow({
  assignment: a,
  course,
  estimate,
  done: savedDone,
  canvasDone,
  ready,
  onToggle,
  color,
  showCourse,
  share,
  steps,
  stepsOpen,
  onToggleSteps,
}: {
  assignment: AssignmentItem;
  course: string;
  estimate: number;
  done: boolean;
  canvasDone: boolean;
  ready: boolean;
  onToggle: () => void;
  color: string;
  showCourse: boolean;
  /** Share of the class's points (0–1), for the impact badge. */
  share: number | null;
  steps: ReturnType<typeof useAssignmentSteps>;
  stepsOpen: boolean;
  onToggleSteps: () => void;
}) {
  const due = a.due_at ? Date.parse(a.due_at) : null;
  const exit = useCompletionExit<HTMLLIElement>(a.id);
  // Playing its completion exit: shown done until it folds away.
  const done = savedDone || exit.completing;
  const missing = !done && a.submission?.missing;
  // By day the section names the day, so a row shows the time (or the date, for
  // work to catch up on). By class it shows the date.
  const when =
    due == null
      ? "No due date"
      : showCourse && due >= Date.now()
        ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(due)
        : formatAssignmentDue(a.due_at);
  const line = [
    showCourse ? course : null,
    when,
    done ? (canvasDone ? "Done in Canvas" : "Done") : formatMinutes(estimate),
    missing ? "Missing" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const itsSteps = steps.stepsFor(a.id);
  const next = nextStep(itsSteps);
  const impact = impactLabel(share);
  // Steps are offered on big work, and kept wherever someone added them.
  const offerSteps = !done && (itsSteps.length > 0 || isBigWork(a.points_possible, estimate));

  return (
    <li
      ref={exit.ref}
      data-todo-row
      tabIndex={-1}
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3.5 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded-lg",
        done && "opacity-55",
      )}
    >
      {/* The class's color: a soft tile that fills solid when done. */}
      <button
        type="button"
        onClick={onToggle}
        disabled={!ready}
        aria-label={`Mark ${a.name} ${done ? "incomplete" : "complete"}`}
        aria-pressed={done}
        data-todo-toggle
        data-completing={exit.completing || undefined}
        // An invisible ring makes a 44px target around the small box.
        className="relative mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition-colors after:absolute after:-inset-3 after:content-[''] disabled:cursor-default"
        style={{
          borderColor: done ? color : `color-mix(in srgb, ${color} 80%, transparent)`,
          backgroundColor: done ? color : `color-mix(in srgb, ${color} 12%, transparent)`,
        }}
      >
        <Check
          className={cn(
            "h-3 w-3 text-background transition-opacity",
            done ? "opacity-100" : "opacity-0",
          )}
          strokeWidth={3}
          aria-hidden="true"
        />
      </button>
      {/* The whole row opens the assignment on its class page, as on the iPhone.
          Personal tasks open details here; class assignments open their assignment page. */}
      <TaskDestination assignment={a}
        className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p
          className={cn(
            "text-[15px] font-medium leading-snug transition-colors group-hover:text-foreground/80",
            done && "line-through",
          )}
        >
          {a.name}
        </p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {line}
          {impact && !done && (
            // How much it counts, not only how soon: "12% of class points".
            <span
              className={cn(
                "ml-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-px align-[1px] text-[11px]",
                isHighImpact(share) ? "bg-primary/15 text-primary" : "bg-foreground/[0.06]",
              )}
            >
              {isHighImpact(share) && <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />}
              {impact}
            </span>
          )}
        </p>
        {next && !done && (
          <p className="mt-1 text-xs text-foreground/80">
            Next: {next.title}
            <span className="text-muted-foreground"> · {stepsPercent(itsSteps)}% done</span>
          </p>
        )}
        <OpensLabel unlockAt={a.unlock_at} className="mt-1" />
        <AssignmentProgressBar assignmentId={a.id} className="mt-2" />
      </TaskDestination>
      {/* Visible actions (nothing only in a gesture): steps, and start studying. */}
      {!done && (
        <div className="flex items-center gap-0.5 self-center">
          {offerSteps && (
            <button
              type="button"
              onClick={onToggleSteps}
              aria-expanded={stepsOpen}
              aria-label={`${stepsOpen ? "Hide" : "Show"} steps for ${a.name}`}
              data-todo-steps
              className={cn(
                "grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground",
                stepsOpen && "bg-foreground/[0.06] text-foreground",
              )}
            >
              <ListChecks className="h-4 w-4" />
            </button>
          )}
          <Link
            to="/study-session"
            search={{ assignment: a.id }}
            aria-label={`Start studying ${a.name}`}
            data-todo-start
            className="press inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span className="hidden sm:inline">Start</span>
          </Link>
        </div>
      )}
      {stepsOpen && !done && (
        <div className="col-span-3 col-start-1 sm:col-span-2 sm:col-start-2">
          <StepList assignment={a} estimate={estimate} steps={steps} color={color} />
        </div>
      )}
    </li>
  );
}
