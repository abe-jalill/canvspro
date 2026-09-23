import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Search, CalendarPlus, ChevronDown, Sparkles, Plus, Trash2 } from "lucide-react";
import {
  useCustomAssignments,
  customToAssignmentItem,
  isCustomAssignmentId,
} from "@/lib/custom-assignments";
import { CompleteToggle } from "@/components/complete-toggle";
import { getCountdown, urgencyTextClass, urgencyAccentClass } from "@/lib/countdown";
import { buildIcs, downloadIcs, safeFilename } from "@/lib/ics";
import { useCourseHighlight, validateCourseSearch } from "@/lib/course-highlight";
import { buildPriorityList, describePriorityList } from "@/lib/priority";
import { useAssignmentMetaMap } from "@/hooks/use-assignment-meta";
import { dropStaleOverdue } from "@/lib/assignment-window";

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

export const Route = createFileRoute("/_authenticated/assignments")({
  head: () => ({
    meta: [
      { title: "Assignments — Canvas Pro" },
      {
        name: "description",
        content:
          "Every class in one card: current grade, overdue count, what's due soon, and the full assignment list.",
      },
      { property: "og:title", content: "Assignments — Canvas Pro" },
      {
        property: "og:description",
        content:
          "Every class in one card: current grade, overdue count, what's due soon, and the full assignment list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: validateCourseSearch,
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
  if (completedHas) return true;
  const s = a.submission;
  return Boolean(s?.submitted_at) || s?.workflow_state === "graded";
}

function formatGrade(score: number | null, grade: string | null) {
  if (score == null && !grade) return "—";
  const parts: string[] = [];
  if (score != null) parts.push(`${score.toFixed(1)}%`);
  if (grade) parts.push(grade);
  return parts.join(" · ");
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
  groups,
  loading,
  error,
  isDone,
  onToggleDone,
}: {
  groups: ReturnType<typeof buildPriorityList>;
  loading: boolean;
  error: Error | null;
  isDone: (id: number) => boolean;
  onToggleDone: (id: number) => void;
}) {
  if (loading) {
    return (
      <GlassCard title="Priority Assignments">
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
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

  const summary = describePriorityList(groups);
  const topItems = groups.flatMap((g) => g.items.slice(0, 2)).slice(0, 5);

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
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  p.urgency === "critical" && "text-red-400 bg-red-400/10 border-red-400/20",
                  p.urgency === "high" && "text-amber-400 bg-amber-400/10 border-amber-400/20",
                  p.urgency === "medium" && "text-blue-400 bg-blue-400/10 border-blue-400/20",
                  p.urgency === "low" &&
                    "text-muted-foreground bg-foreground/5 border-foreground/10",
                )}
              >
                {p.urgency}
              </span>
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
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const highlight = useCourseHighlight();
  const custom = useCustomAssignments();

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
    // Anything due more than a day ago is left out entirely.
    return dropStaleOverdue([
      ...(data ?? []),
      ...custom.list.map((c) => customToAssignmentItem(c, courseById.get(c.course_id))),
    ]);
  }, [data, custom.list, courses.data]);

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
      g.items = g.items.filter((a) => !isDone(a, completed.has(a.id)));
      g.items.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });
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
  }, [courses.data, allAssignments, completed]);

  const metaMap = useAssignmentMetaMap();
  const priorityGroups = useMemo(() => {
    const estimates: Record<number, number | null> = {};
    for (const [id, meta] of metaMap.entries()) {
      estimates[id] = meta.estimatedMinutes;
    }
    return buildPriorityList(
      allAssignments,
      (courses.data ?? []).map((c) => ({
        id: c.id,
        name: displayCourseName(c.name, c.course_code),
        course_code: c.course_code,
      })),
      completed.has,
      Date.now(),
      { estimates },
    );
  }, [allAssignments, courses.data, completed.has, metaMap]);

  const q = search.trim().toLowerCase();
  const visibleGroups = q
    ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter((a) => a.name.toLowerCase().includes(q)),
        }))
        .filter((g) => g.items.length > 0)
    : groups.filter((g) => g.items.length > 0);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6">
      <header className="px-1 pt-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          By class
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Assignments</h1>
      </header>

      <div className="glass-panel-strong relative flex items-center gap-2 px-4 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assignments or classes…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Search assignments"
        />
      </div>

      <PriorityAssignmentsCard
        groups={priorityGroups}
        loading={isLoading}
        error={isError ? (error as Error) : null}
        isDone={(id) => completed.has(id)}
        onToggleDone={(id) => completed.toggle(id)}
      />

      {courseOptions.length > 0 && (
        <GlassCard
          title="Your own assignments"
          subtitle="Add anything Canvas doesn't have: due date, points and notes"
        >
          <AddAssignmentForm courseOptions={courseOptions} onAdd={custom.add} />
        </GlassCard>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
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
    </div>
  );
}

function AddToCalendarButton({ assignment }: { assignment: AssignmentItem }) {
  const onClick = () => {
    if (!assignment.due_at) return;
    const start = new Date(assignment.due_at);
    const ics = buildIcs({
      uid: `canvas-assignment-${assignment.id}@lovable`,
      title: `${assignment.name} (${displayCourseName(
        assignment.course_name,
        assignment.course_code,
      )})`,
      description: `Assignment due on Canvas.`,
      url: assignment.html_url,
      start,
    });
    downloadIcs(`${safeFilename(assignment.name)}.ics`, ics);
  };
  return (
    <button
      onClick={onClick}
      aria-label={`Add ${assignment.name} to calendar`}
      title="Add to calendar (.ics)"
      className="glass-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-glass-border text-muted-foreground hover:text-foreground"
    >
      <CalendarPlus className="h-4 w-4" />
    </button>
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
