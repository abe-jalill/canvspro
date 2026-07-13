import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { getAllAssignmentsFn } from "@/lib/canvas.functions";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { cn } from "@/lib/utils";

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

type Filter = "all" | "upcoming" | "missing" | "submitted";

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

  const filtered = (data ?? [])
    .filter((a) => {
      const status = statusLabel(a);
      if (filter === "upcoming") {
        if (!a.due_at) return false;
        return new Date(a.due_at).getTime() >= Date.now();
      }
      if (filter === "missing")
        return status === "Missing" || status === "Overdue";
      if (filter === "submitted")
        return status.startsWith("Submitted") || status === "Graded";
      return true;
    })
    .sort((a, b) => {
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "upcoming", label: "Upcoming" },
    { id: "missing", label: "Missing" },
    { id: "submitted", label: "Submitted" },
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
            {filtered.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {a.course_name}
                  </p>
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
                    {statusLabel(a)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
