import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  getAllAssignmentsFn,
  getCoursesFn,
  type AssignmentItem,
  type CourseSummary,
} from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { cn } from "@/lib/utils";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { Search, Sparkles, Plus, Trash2, ListTodo, Clock3, ChevronDown } from "lucide-react";
import {
  useCustomAssignments,
  customToAssignmentItem,
  isCustomAssignmentId,
} from "@/lib/custom-assignments";
import { CompleteToggle } from "@/components/complete-toggle";
import { getCountdown, urgencyTextClass, urgencyAccentClass } from "@/lib/countdown";
import { AddToCalendarButton as SharedCalBtn } from "@/components/add-to-calendar-button";
const AddToCalendarButton = ({ assignment }: { assignment: AssignmentItem }) => (
  <SharedCalBtn
    assignment={assignment}
    className="glass-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-glass-border text-muted-foreground hover:text-foreground"
  />
);
import { useCourseHighlight, validateCourseSearch } from "@/lib/course-highlight";
import {
  buildPriorityQueue,
  describePriorityQueue,
  type PriorityQueueItem,
} from "@/lib/get-it-done";
import { PriorityBadge } from "@/components/priority-badge";
import { useAssignmentMetaMap } from "@/hooks/use-assignment-meta";
import {
  compareByDueDate,
  isAssignmentComplete,
  isAssignmentVisible,
} from "@/lib/assignment-window";
import { htmlToText } from "@/lib/html-text";

import {
  coursesQueryOptions as coursesQO,
  assignmentsQueryOptions as assignmentsQO,
} from "@/lib/canvas.queries";
import {
  AssignmentGroupSkeleton,
  AssignmentRowSkeleton,
  SkeletonBlock,
} from "@/components/skeletons/dashboard-skeletons";

const LEGACY_CLASS_LAYOUT_ENABLED = false;

export const Route = createFileRoute("/_authenticated/assignments")({
  head: () => ({
    meta: [
      { title: "Assignments — CanvasPro" },
      {
        name: "description",
        content:
          "Every class in one card: current grade, overdue count, what's due soon, and the full assignment list.",
      },
      { property: "og:title", content: "Assignments — CanvasPro" },
      {
        property: "og:description",
        content:
          "Every class in one card: current grade, overdue count, what's due soon, and the full assignment list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: { course?: unknown; assignment?: unknown }) => ({
    ...validateCourseSearch(search),
    ...(typeof search.assignment === "string" ? { assignment: search.assignment } : {}),
  }),
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(assignmentsQO);
      void context.queryClient.ensureQueryData(coursesQO);
    }
  },
  component: AssignmentsPage,
});

function statusLabel(a: AssignmentItem) {
  const s = a.submission;
  if (s?.missing) return "Missing";
  if (s?.workflow_state === "graded") return "Graded";
  if (s?.submitted_at) return s.late ? "Submitted (late)" : "Submitted";
  if (a.due_at && new Date(a.due_at).getTime() < Date.now()) return "Overdue";
  return "Not submitted";
}

function isDone(a: AssignmentItem, completedHas: boolean) {
  return isAssignmentComplete(a, completedHas);
}

interface ClassGroup {
  id: number;
  label: string;
  score: number | null;
  grade: string | null;
  items: AssignmentItem[];
  overdue: number;
  dueSoon: number;
}

function PriorityAssignmentsCard({
  queue,
  loading,
  error,
  isDone,
  onToggleDone,
}: {
  queue: PriorityQueueItem[];
  loading: boolean;
  error: Error | null;
  isDone: (id: number) => boolean;
  onToggleDone: (id: number) => void;
}) {
  if (loading) {
    return (
      <GlassCard
        title="Priority Assignments"
        subtitle="Smart ordering by deadline and weight"
        className="overflow-hidden"
      >
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-3/4 max-w-sm" />
          <div className="space-y-2 pt-1">
            <AssignmentRowSkeleton index={0} showCalendarBtn={false} />
            <AssignmentRowSkeleton index={1} showCalendarBtn={false} />
          </div>
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard title="Priority Assignments">
        <ErrorState message={error.message} />
      </GlassCard>
    );
  }

  const summary = describePriorityQueue(queue, (a) =>
    displayCourseName(a.course_name, a.course_code),
  );
  const topItems = queue.slice(0, 5);

  return (
    <GlassCard
      title="Priority Assignments"
      subtitle="Smart ordering by deadline and weight"
      className="overflow-hidden"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
          <Sparkles className="h-4 w-4 text-foreground/80" />
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
      </div>

      {topItems.length > 0 && (
        <ul className="mt-4 space-y-2">
          {topItems.map((p) => (
            <li
              key={p.assignment.id}
              className={cn(
                "glass-inset flex items-center justify-between gap-3 p-3",
                isDone(p.assignment.id) && "opacity-60",
              )}
            >
              <CompleteToggle
                done={isDone(p.assignment.id)}
                onToggle={() => onToggleDone(p.assignment.id)}
                label={p.assignment.name}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    isDone(p.assignment.id) && "line-through",
                  )}
                >
                  {p.assignment.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {displayCourseName(p.assignment.course_name, p.assignment.course_code)}
                </p>
              </div>
              <PriorityBadge urgency={p.urgency} />
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function AssignmentsPage() {
  const { data, isLoading, isError, error } = useQuery(assignmentsQO);
  const courses = useQuery(coursesQO);
  const [search, setSearch] = useState("");
  const [undatedOpen, setUndatedOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const highlight = useCourseHighlight();
  const custom = useCustomAssignments();
  const routeSearch = Route.useSearch();

  const courseOptions = useMemo(
    () =>
      (courses.data ?? []).map((c) => ({
        id: c.id,
        label: displayCourseName(c.name, c.course_code),
      })),
    [courses.data],
  );

  const allAssignments: AssignmentItem[] = useMemo(() => {
    const courseById = new Map(
      (courses.data ?? []).map((c) => [c.id, { name: c.name, course_code: c.course_code }]),
    );
    // This is the complete Assignments page. Time limits used by Get It Done,
    // Focus, Schedule, or a course page must never narrow this source list.
    return [
      ...(data ?? []),
      ...custom.list.map((c) => customToAssignmentItem(c, courseById.get(c.course_id))),
    ];
  }, [data, custom.list, courses.data]);
  const selectedAssignment = routeSearch.assignment
    ? allAssignments.find(
        (assignment) =>
          String(assignment.id) === routeSearch.assignment &&
          isAssignmentVisible(assignment, completed.has(assignment.id), showCompleted),
      )
    : undefined;

  useEffect(() => {
    if (!selectedAssignment) return;
    const timer = window.setTimeout(
      () =>
        document
          .getElementById("selected-assignment-description")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [selectedAssignment]);

  const groups: ClassGroup[] = useMemo(() => {
    const map = new Map<number, ClassGroup>();
    const addCourse = (id: number, label: string, c?: CourseSummary): ClassGroup => {
      let g = map.get(id);
      if (!g) {
        g = {
          id,
          label,
          score: c?.current_score ?? null,
          grade: c?.current_grade ?? null,
          items: [],
          overdue: 0,
          dueSoon: 0,
        };
        map.set(id, g);
      }
      return g;
    };

    const courseById = new Map((courses.data ?? []).map((course) => [course.id, course]));
    allAssignments.forEach((a) => {
      const course = courseById.get(a.course_id);
      const g = addCourse(a.course_id, displayCourseName(a.course_name, a.course_code), course);
      g.items.push(a);
    });

    const now = Date.now();
    const threeDays = now + 3 * 24 * 60 * 60 * 1000;
    for (const g of map.values()) {
      g.items = g.items.filter((a) =>
        isAssignmentVisible(a, completed.has(a.id), showCompleted, now),
      );
      g.items.sort(compareByDueDate);
      for (const a of g.items) {
        if (!a.due_at) continue;
        const t = new Date(a.due_at).getTime();
        if (t < now) g.overdue += 1;
        else if (t <= threeDays) g.dueSoon += 1;
      }
    }

    return Array.from(map.values())
      .filter((group) => group.items.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [courses.data, allAssignments, completed, showCompleted]);

  const metaMap = useAssignmentMetaMap();
  const priorityQueue = useMemo(() => {
    const estimates = new Map<number, number | null>();
    for (const [id, meta] of metaMap.entries()) {
      estimates.set(id, meta.estimatedMinutes);
    }
    return buildPriorityQueue({ assignments: allAssignments, completed: completed.has, estimates });
  }, [allAssignments, completed.has, metaMap]);

  const q = search.trim().toLowerCase();
  const visibleGroups = q
    ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter((a) =>
            `${g.label} ${a.name} ${a.course_code}`.toLowerCase().includes(q),
          ),
        }))
        .filter((g) => g.items.length > 0)
    : groups.filter((g) => g.items.length > 0);

  const now = Date.now();
  // Flatten across classes, then order by deadline so the agenda reads in
  // true urgency order rather than grouped by class name.
  const agendaItems = visibleGroups
    .flatMap((group) => group.items.map((assignment) => ({ assignment, course: group.label })))
    .sort((a, b) => compareByDueDate(a.assignment, b.assignment));
  const agendaSections = [
    {
      title: "Overdue",
      detail: "Needs attention first",
      tone: "text-red-500",
      items: agendaItems.filter(
        ({ assignment }) => assignment.due_at && new Date(assignment.due_at).getTime() < now,
      ),
    },
    {
      title: "Next 7 days",
      detail: "Your immediate runway",
      tone: "text-primary",
      items: agendaItems.filter(({ assignment }) => {
        if (!assignment.due_at) return false;
        const due = new Date(assignment.due_at).getTime();
        return due >= now && due <= now + 7 * 24 * 60 * 60 * 1_000;
      }),
    },
    {
      title: "Later",
      detail: "Beyond this week",
      tone: "text-muted-foreground",
      items: agendaItems.filter(
        ({ assignment }) =>
          assignment.due_at &&
          new Date(assignment.due_at).getTime() > now + 7 * 24 * 60 * 60 * 1_000,
      ),
    },
    {
      title: "No due date",
      detail: "Keep these on your radar",
      tone: "text-muted-foreground",
      items: agendaItems.filter(({ assignment }) => !assignment.due_at),
    },
  ].filter((section) => section.items.length > 0);
  const overdueCount =
    agendaSections.find((section) => section.title === "Overdue")?.items.length ?? 0;
  const weekCount =
    agendaSections.find((section) => section.title === "Next 7 days")?.items.length ?? 0;
  const toggle = (id: number) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6">
      <section className="glass-panel-strong premium-reveal relative isolate overflow-hidden rounded-[2rem] border border-primary/15 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <ListTodo className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Complete workload
            </p>
            <h1 className="mt-2 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
              One agenda. Every assignment.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Work is ordered by urgency across every class, so the next deadline is always obvious.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[24rem]">
            <div className="rounded-2xl border border-foreground/10 bg-background/35 p-4 backdrop-blur-md">
              <p className="text-3xl font-medium tabular-nums tracking-[-0.05em]">
                {agendaItems.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Remaining</p>
            </div>
            <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.06] p-4 backdrop-blur-md">
              <p className="text-3xl font-medium tabular-nums tracking-[-0.05em] text-red-500">
                {overdueCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Overdue</p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/[0.06] p-4 backdrop-blur-md">
              <p className="text-3xl font-medium tabular-nums tracking-[-0.05em] text-primary">
                {weekCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">This week</p>
            </div>
          </div>
        </div>
      </section>

      <div
        className="glass-panel-strong premium-reveal relative flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
        style={{ animationDelay: "65ms" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find any assignment or course"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search assignments"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(event) => setShowCompleted(event.target.checked)}
          />
          Show completed
        </label>
        <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
          {agendaItems.length} shown
        </span>
      </div>

      {selectedAssignment && (
        <section
          id="selected-assignment-description"
          className="glass-panel-strong premium-reveal scroll-mt-6 rounded-[1.75rem] border border-primary/25 p-5 sm:p-6"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
            Assignment description
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
            {selectedAssignment.name}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {displayCourseName(selectedAssignment.course_name, selectedAssignment.course_code)}
          </p>
          <p className="mt-5 whitespace-pre-line text-sm leading-6 text-foreground/80">
            {htmlToText(selectedAssignment.description ?? "") ||
              "Canvas does not provide a description for this assignment."}
          </p>
          {selectedAssignment.html_url && (
            <a
              href={selectedAssignment.html_url}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex text-xs font-medium text-primary hover:opacity-80"
            >
              Open assignment in Canvas
            </a>
          )}
        </section>
      )}

      <PriorityAssignmentsCard
        queue={priorityQueue}
        loading={isLoading}
        error={isError ? (error as Error) : null}
        isDone={(id) => completed.has(id)}
        onToggleDone={(id) => completed.toggle(id)}
      />

      {courseOptions.length > 0 && (
        <details className="glass-panel group rounded-2xl border border-foreground/10 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Add something Canvas doesn't have
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <AddAssignmentForm courseOptions={courseOptions} onAdd={custom.add} />
        </details>
      )}

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <AssignmentGroupSkeleton key={i} index={i} />
          ))}
        </div>
      )}
      {isError && (
        <GlassCard>
          <ErrorState message={(error as Error).message} />
        </GlassCard>
      )}
      {!isLoading && !isError && visibleGroups.length === 0 && (
        <GlassCard>
          <EmptyState message="No classes found." />
        </GlassCard>
      )}

      {!isLoading && !isError && agendaSections.length > 0 && (
        <section
          className="glass-panel premium-card overflow-hidden rounded-[1.75rem] border border-foreground/10"
          style={{ animationDelay: "100ms" }}
        >
          {agendaSections.map((section) => (
            <div key={section.title} className="border-b border-foreground/10 last:border-0">
              <div className="flex items-end justify-between gap-3 bg-foreground/[0.025] px-4 py-4 sm:px-6">
                <div>
                  <h2
                    className={cn(
                      "text-sm font-semibold uppercase tracking-[0.14em]",
                      section.tone,
                    )}
                  >
                    {section.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">{section.detail}</p>
                </div>
                <span className="text-2xl font-medium tabular-nums tracking-[-0.05em]">
                  {section.items.length}
                </span>
              </div>
              {section.title === "No due date" && !q && (
                <div className="px-4 py-3 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setUndatedOpen((open) => !open)}
                    aria-expanded={undatedOpen}
                    className="glass-hover inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {undatedOpen ? "Hide" : `Show ${section.items.length}`} with no due date
                  </button>
                </div>
              )}
              <ul hidden={section.title === "No due date" && !q && !undatedOpen}>
                {section.items.map(({ assignment: a, course }) => {
                  const done = isDone(a, completed.has(a.id));
                  const canvasDone = isAssignmentComplete(a, false);
                  const cd = getCountdown(a.due_at, { completed: done });
                  const mine = isCustomAssignmentId(a.id);
                  const notes = custom.notesById.get(a.id);
                  const highlightProps = highlight(course);
                  const firstForCourse =
                    agendaItems.find((entry) => entry.course === course)?.assignment.id === a.id;
                  return (
                    <li
                      key={a.id}
                      id={firstForCourse ? highlightProps.id : undefined}
                      className={cn(
                        "group grid gap-3 border-t border-foreground/[0.07] px-4 py-4 transition-colors first:border-0 hover:bg-foreground/[0.025] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-6",
                        done && "opacity-60",
                        highlightProps.className,
                      )}
                    >
                      <CompleteToggle
                        done={done}
                        onToggle={() => completed.toggle(a.id)}
                        label={a.name}
                        disabled={!completed.ready || canvasDone}
                        className="h-5 w-5"
                      />
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-sm font-medium sm:text-base",
                            done && "line-through",
                          )}
                        >
                          {a.name}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span className="truncate text-primary/90">{course}</span>
                          <span className="opacity-40">·</span>
                          <span>{done ? "Completed" : mine ? "Added by you" : statusLabel(a)}</span>
                          {a.points_possible != null && (
                            <>
                              <span className="opacity-40">·</span>
                              <span>{a.points_possible} pts</span>
                            </>
                          )}
                        </p>
                        {notes && (
                          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-foreground/70">
                            {notes}
                          </p>
                        )}
                        {a.description && (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                              See description
                            </summary>
                            <p className="mt-2 whitespace-pre-line leading-5 text-foreground/75">
                              {htmlToText(a.description)}
                            </p>
                          </details>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 pl-8 sm:justify-end sm:pl-0">
                        <div className="text-left sm:text-right">
                          <p
                            className={cn(
                              "inline-flex items-center gap-1.5 text-sm tabular-nums",
                              cd ? urgencyTextClass(cd.urgency) : "text-muted-foreground",
                            )}
                          >
                            <Clock3 className="h-3.5 w-3.5" />
                            {cd ? cd.label : "No due date"}
                          </p>
                          {cd && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {cd.fullDate}
                            </p>
                          )}
                        </div>
                        {a.due_at && <AddToCalendarButton assignment={a} />}
                        {mine && (
                          <button
                            type="button"
                            onClick={() => custom.remove(a.id)}
                            aria-label={`Delete ${a.name}`}
                            className="glass-hover flex h-8 w-8 items-center justify-center rounded-xl border border-glass-border text-muted-foreground hover:text-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {LEGACY_CLASS_LAYOUT_ENABLED && (
        <div className="space-y-3">
          {visibleGroups.map((g) => {
            const open = expanded.has(g.id) || Boolean(q);
            return (
              <div key={g.id} {...highlight(g.label)}>
                <GlassCard className="p-0 sm:p-0 md:p-0">
                  <button
                    onClick={() => toggle(g.id)}
                    aria-expanded={open}
                    className="glass-hover grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left sm:p-6"
                  >
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                        {g.label}
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className={cn(g.overdue > 0 && "font-semibold text-foreground")}>
                          {g.overdue} overdue
                        </span>
                        <span className="opacity-40">·</span>
                        <span className={cn(g.dueSoon > 0 && "text-foreground/85")}>
                          {g.dueSoon} due within 3 days
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-semibold tabular-nums tracking-tight">
                          {formatGrade(g.score, g.grade)}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          Grade
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-glass-border p-4 sm:p-6">
                      <ul className="space-y-2">
                        {g.items.map((a) => {
                          const done = completed.has(a.id);
                          const cd = getCountdown(a.due_at, { completed: done });
                          const mine = isCustomAssignmentId(a.id);
                          const notes = custom.notesById.get(a.id);
                          return (
                            <li
                              key={a.id}
                              className={cn(
                                "glass-inset flex items-start justify-between gap-4 p-3 transition-opacity",
                                cd ? urgencyAccentClass(cd.urgency) : "",
                                done && "opacity-60",
                              )}
                            >
                              <div className="flex min-w-0 items-start gap-3">
                                <CompleteToggle
                                  done={done}
                                  onToggle={() => completed.toggle(a.id)}
                                  label={a.name}
                                  disabled={!completed.ready}
                                  className="mt-0.5 h-5 w-5"
                                />
                                <div className="min-w-0">
                                  <p
                                    className={cn(
                                      "truncate text-sm font-medium",
                                      done && "line-through",
                                    )}
                                  >
                                    {a.name}
                                  </p>
                                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                    <span>
                                      {done ? "Completed" : mine ? "Added by you" : statusLabel(a)}
                                    </span>
                                    {a.points_possible != null && (
                                      <>
                                        <span className="opacity-40">·</span>
                                        <span>{a.points_possible} pts</span>
                                      </>
                                    )}
                                  </p>
                                  {notes && (
                                    <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/70">
                                      {notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-start gap-2">
                                <div className="text-right">
                                  <p
                                    className={cn(
                                      "text-sm tabular-nums",
                                      cd ? urgencyTextClass(cd.urgency) : "text-muted-foreground",
                                    )}
                                  >
                                    {cd ? cd.label : "No due date"}
                                  </p>
                                  {cd && (
                                    <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground/80">
                                      {cd.fullDate}
                                    </p>
                                  )}
                                </div>
                                {a.due_at && <AddToCalendarButton assignment={a} />}
                                {mine && (
                                  <button
                                    type="button"
                                    onClick={() => custom.remove(a.id)}
                                    aria-label={`Delete ${a.name}`}
                                    title="Delete"
                                    className="glass-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-glass-border text-muted-foreground hover:text-foreground"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      <AddAssignmentForm courseId={g.id} courseLabel={g.label} onAdd={custom.add} />
                    </div>
                  )}
                </GlassCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddAssignmentForm({
  courseId,
  courseLabel,
  courseOptions,
  onAdd,
}: {
  courseId?: number;
  courseLabel?: string;
  courseOptions?: { id: number; label: string }[];
  onAdd: (input: {
    course_id: number;
    name: string;
    due_at: string | null;
    points_possible: number | null;
    notes: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [points, setPoints] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string>(courseId != null ? String(courseId) : "");

  const targetId = courseId ?? (selected ? Number(selected) : NaN);
  const canSave = name.trim().length > 0 && Number.isFinite(targetId);

  function reset() {
    setName("");
    setDue("");
    setPoints("");
    setNotes("");
    if (courseId == null) setSelected("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const pts = parseFloat(points);
    onAdd({
      course_id: targetId,
      name: name.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      points_possible: Number.isNaN(pts) ? null : pts,
      notes: notes.trim(),
    });
    reset();
    setOpen(false);
  }

  const inputClass =
    "w-full rounded-lg border border-glass-border bg-background/50 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-hover mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-glass-border px-3 py-2 text-sm font-medium"
      >
        <Plus className="h-4 w-4" />
        Add assignment{courseLabel ? "" : " to a class"}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="glass-inset mt-3 space-y-3 p-3">
      {courseId == null && (
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className={inputClass}
          aria-label="Class"
        >
          <option value="">Choose a class…</option>
          {(courseOptions ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Assignment name"
        aria-label="Assignment name"
        className={inputClass}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Due</span>
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Points</span>
          <input
            type="number"
            min={0}
            step="any"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="e.g. 100"
            className={inputClass}
          />
        </label>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        aria-label="Notes"
        rows={2}
        className={inputClass}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!canSave}
          className="glass-hover min-h-11 rounded-xl border border-glass-border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Save assignment
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="min-h-11 rounded-xl px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function formatGrade(score: number | null | undefined, grade: string | null | undefined) {
  if (typeof score === "number" && Number.isFinite(score)) return `${score.toFixed(1)}%`;
  return grade || "—";
}
