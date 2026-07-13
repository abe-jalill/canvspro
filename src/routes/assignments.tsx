import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { getAllAssignmentsFn } from "@/lib/canvas.functions";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { cn } from "@/lib/utils";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { Check } from "lucide-react";

const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
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

function statusLabel(a: {
  due_at: string | null;
  submission?: {
    workflow_state?: string;
    submitted_at?: string | null;
    missing?: boolean;
    late?: boolean;
  };
}) {
  const s = a.submission;
  if (s?.missing) return "Missing";
  if (s?.workflow_state === "graded") return "Graded";
  if (s?.submitted_at) return s.late ? "Submitted (late)" : "Submitted";
  if (a.due_at && new Date(a.due_at).getTime() < Date.now()) return "Overdue";
  return "Not submitted";
}

function AssignmentsPage() {
  const { data, isLoading, isError, error } = useQuery(assignmentsQO);
  const [filter, setFilter] = useState<Filter>("all");
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);

  const filtered = (data ?? [])
    .filter((a) => {
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

      <div className="glass-panel-strong flex gap-1 p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
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
          <EmptyState message="No assignments match this filter." />
        )}
        {filtered.length > 0 && (
          <ul className="divide-y divide-foreground/10">
            {filtered.map((a) => {
              const done = completed.has(a.id);
              return (
                <li
                  key={a.id}
                  className={cn(
                    "flex items-start justify-between gap-4 py-3 transition-opacity",
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
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium tabular-nums text-muted-foreground">
                      {a.due_at
                        ? new Date(a.due_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "No due date"}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {done ? "Completed" : statusLabel(a)}
                    </p>
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
