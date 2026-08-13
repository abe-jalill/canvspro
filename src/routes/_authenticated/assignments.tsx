import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  getAllAssignmentsFn,
  getCoursesFn,
  type AssignmentItem,
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
import { Check, Search, CalendarPlus } from "lucide-react";
import {
  getCountdown,
  urgencyTextClass,
  urgencyAccentClass,
} from "@/lib/countdown";
import { buildIcs, downloadIcs, safeFilename } from "@/lib/ics";

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

export const Route = createFileRoute("/assignments")({
  head: () => ({
    meta: [
      { title: "Assignments — Canvas Student" },
      {
        name: "description",
        content: "All assignments across your Canvas courses with status.",
      },
    ],
  }),
  component: AssignmentsPage,
});

type Filter = "all" | "upcoming" | "missing" | "submitted" | "completed";

function statusLabel(a: AssignmentItem) {
  const s = a.submission;
  if (s?.missing) return "Missing";
  if (s?.workflow_state === "graded") return "Graded";
  if (s?.submitted_at) return s.late ? "Submitted (late)" : "Submitted";
  if (a.due_at && new Date(a.due_at).getTime() < Date.now()) return "Overdue";
  return "Not submitted";
}

function AssignmentsPage() {
  const { data, isLoading, isError, error } = useQuery(assignmentsQO);
  const courses = useQuery(coursesQO);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);

  const courseOptions = useMemo(() => {
    const seen = new Map<number, string>();
    (courses.data ?? []).forEach((c) =>
      seen.set(c.id, displayCourseName(c.name, c.course_code)),
    );
    (data ?? []).forEach((a) => {
      if (!seen.has(a.course_id)) {
        seen.set(a.course_id, displayCourseName(a.course_name, a.course_code));
      }
    });
    return Array.from(seen.entries())
      .map(([id, label]) => ({ id: String(id), label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [courses.data, data]);

  const filtered = (data ?? [])
    .filter((a) => {
      if (courseFilter !== "all" && String(a.course_id) !== courseFilter)
        return false;
      if (
        search.trim() &&
        !a.name.toLowerCase().includes(search.trim().toLowerCase())
      )
        return false;
      const status = statusLabel(a);
      const done = completed.has(a.id);
      if (filter === "completed") return done;
      if (filter === "upcoming") {
        if (done) return false;
        if (!a.due_at) return false;
        return new Date(a.due_at).getTime() >= Date.now();
      }
      if (filter === "missing")
        return !done && (status === "Missing" || status === "Overdue");
      if (filter === "submitted")
        return status.startsWith("Submitted") || status === "Graded";
      return true;
    })
    .sort((a, b) => {
      const ac = completed.has(a.id) ? 1 : 0;
      const bc = completed.has(b.id) ? 1 : 0;
      if (ac !== bc) return ac - bc;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "upcoming", label: "Upcoming" },
    { id: "missing", label: "Missing" },
    { id: "submitted", label: "Submitted" },
    { id: "completed", label: "Completed" },
  ];

  const hasActiveSearch = search.trim().length > 0 || courseFilter !== "all";
  const emptyMessage = hasActiveSearch
    ? "No matching assignments found."
    : "No assignments match this filter.";

  return (
    <div className="space-y-6">
      <header className="px-1 pt-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          All courses
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Assignments
        </h1>
      </header>

      {/* Search + course dropdown */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="glass-panel-strong relative flex flex-1 items-center gap-2 px-4 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assignments…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search assignments"
          />
        </div>
        <div className="glass-panel-strong flex items-center px-3 py-1.5">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            aria-label="Filter by class"
            className="cursor-pointer bg-transparent px-2 py-1 text-sm outline-none"
          >
            <option value="all">All classes</option>
            {courseOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-panel-strong flex gap-1 overflow-x-auto p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-colors",
              filter === t.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <GlassCard>
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}
        {isError && <ErrorState message={(error as Error).message} />}
        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState message={emptyMessage} />
        )}
        {filtered.length > 0 && (
          <ul className="space-y-2">
            {filtered.map((a) => {
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
                        {displayCourseName(a.course_name, a.course_code)}
                        <span className="ml-2 opacity-70">
                          · {done ? "Completed" : statusLabel(a)}
                        </span>
                      </p>
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
                    {a.due_at && (
                      <AddToCalendarButton assignment={a} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>
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
    downloadIcs(
      `${safeFilename(assignment.name)}.ics`,
      ics,
    );
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
