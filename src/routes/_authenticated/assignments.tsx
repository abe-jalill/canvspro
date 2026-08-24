import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  getAllAssignmentsFn,
  getCoursesFn,
  type AssignmentItem,
  type CourseSummary,
} from "@/lib/canvas.functions";
import {
  GlassCard,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components/glass-card";
import { cn } from "@/lib/utils";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { Check, Search, CalendarPlus, ChevronDown } from "lucide-react";
import {
  getCountdown,
  urgencyTextClass,
  urgencyAccentClass,
} from "@/lib/countdown";
import { buildIcs, downloadIcs, safeFilename } from "@/lib/ics";
import {
  useCourseHighlight,
  validateCourseSearch,
} from "@/lib/course-highlight";

const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
  staleTime: 5 * 60_000,
});

const coursesQO = queryOptions({
  queryKey: ["canvas", "courses"],
  queryFn: () => getCoursesFn(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/_authenticated/assignments")({
  head: () => ({
    meta: [
      { title: "Assignments — Canvas Pro" },
      { name: "description", content: "Every class in one card: current grade, overdue count, what's due soon, and the full assignment list." },
      { property: "og:title", content: "Assignments — Canvas Pro" },
      { property: "og:description", content: "Every class in one card: current grade, overdue count, what's due soon, and the full assignment list." },
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

function AssignmentsPage() {
  const { data, isLoading, isError, error } = useQuery(assignmentsQO);
  const courses = useQuery(coursesQO);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const highlight = useCourseHighlight();

  const groups: ClassGroup[] = useMemo(() => {
    const map = new Map<number, ClassGroup>();
    const addCourse = (
      id: number,
      label: string,
      c?: CourseSummary,
    ): ClassGroup => {
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

    (courses.data ?? []).forEach((c) =>
      addCourse(c.id, displayCourseName(c.name, c.course_code), c),
    );
    (data ?? []).forEach((a) => {
      const g = addCourse(
        a.course_id,
        displayCourseName(a.course_name, a.course_code),
      );
      g.items.push(a);
    });

    const now = Date.now();
    const threeDays = now + 3 * 24 * 60 * 60 * 1000;
    for (const g of map.values()) {
      g.items.sort((a, b) => {
        const ac = isDone(a, completed.has(a.id)) ? 1 : 0;
        const bc = isDone(b, completed.has(b.id)) ? 1 : 0;
        if (ac !== bc) return ac - bc;
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });
      for (const a of g.items) {
        if (isDone(a, completed.has(a.id))) continue;
        if (!a.due_at) continue;
        const t = new Date(a.due_at).getTime();
        if (t < now) g.overdue += 1;
        else if (t <= threeDays) g.dueSoon += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [courses.data, data, completed]);

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
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Assignments
        </h1>
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
                  {g.items.length === 0 ? (
                    <EmptyState message="No assignments for this class." />
                  ) : (
                    <ul className="space-y-2">
                      {g.items.map((a) => {
                        const done = completed.has(a.id);
                        const cd = getCountdown(a.due_at, { completed: done });
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
                              <button
                                onClick={() => completed.toggle(a.id)}
                                aria-label={
                                  done
                                    ? `Mark ${a.name} incomplete`
                                    : `Mark ${a.name} complete`
                                }
                                aria-pressed={done}
                                className={cn(
                                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                                  done
                                    ? "border-foreground/60 bg-foreground/80 text-background"
                                    : "border-foreground/30 text-transparent hover:border-foreground/60 hover:text-foreground/60",
                                )}
                              >
                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              </button>
                              <div className="min-w-0">
                                <p
                                  className={cn(
                                    "truncate text-sm font-medium",
                                    done && "line-through",
                                  )}
                                >
                                  {a.name}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {done ? "Completed" : statusLabel(a)}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-start gap-2">
                              <div className="text-right">
                                <p
                                  className={cn(
                                    "text-sm tabular-nums",
                                    cd
                                      ? urgencyTextClass(cd.urgency)
                                      : "text-muted-foreground",
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
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
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
