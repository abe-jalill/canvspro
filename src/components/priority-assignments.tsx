import { useMemo } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { getAllAssignmentsFn, getCoursesFn, type AssignmentItem } from "@/lib/canvas.functions";
import { GlassCard, Skeleton, ErrorState } from "@/components/glass-card";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { displayCourseName } from "@/lib/course-display";
import { buildPriorityList, describePriorityList } from "@/lib/priority";
import { cn } from "@/lib/utils";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { useAssignmentMetaMap, useSetAssignmentEstimate } from "@/hooks/use-assignment-meta";
import { Clock } from "lucide-react";
import { CompleteToggle } from "@/components/complete-toggle";
import { useState } from "react";

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

function urgencyClass(urgency: string) {
  switch (urgency) {
    case "critical":
      return "text-red-400 bg-red-400/10 border-red-400/20";
    case "high":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "medium":
      return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    default:
      return "text-muted-foreground bg-foreground/5 border-foreground/10";
  }
}

function EstimateEditor({
  assignmentId,
  courseId,
  minutes,
}: {
  assignmentId: number;
  courseId: number;
  minutes: number | null;
}) {
  const [draft, setDraft] = useState<string>(minutes === null ? "" : String(minutes));
  const { mutate, isPending } = useSetAssignmentEstimate();

  function save() {
    const value = parseInt(draft, 10);
    mutate({
      assignmentId,
      courseId,
      minutes: Number.isNaN(value) || value <= 0 ? null : value,
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        type="number"
        min={0}
        step={15}
        placeholder="Time est. (min)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
        disabled={isPending}
        className="w-28 rounded-md border border-foreground/10 bg-background/50 px-2 py-1 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      />
    </div>
  );
}

export function PriorityAssignmentsWidget() {
  const assignments = useQuery(assignmentsQO);
  const courses = useQuery(coursesQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const metaMap = useAssignmentMetaMap();

  const groups = useMemo(() => {
    const estimates: Record<number, number | null> = {};
    for (const [id, meta] of metaMap.entries()) {
      estimates[id] = meta.estimatedMinutes;
    }
    return buildPriorityList(
      assignments.data ?? [],
      (courses.data ?? []).map((c) => ({
        id: c.id,
        name: displayCourseName(c.name, c.course_code),
        course_code: c.course_code,
      })),
      completed.has,
      Date.now(),
      { estimates },
    );
  }, [assignments.data, courses.data, completed.has, metaMap]);

  const summary = describePriorityList(groups);

  const topItems = groups.flatMap((g) => g.items.slice(0, 2)).slice(0, 5);

  if (assignments.isLoading || courses.isLoading) {
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

  if (assignments.isError || courses.isError) {
    return (
      <GlassCard title="Priority Assignments">
        <ErrorState
          message={
            (assignments.error as Error | undefined)?.message ??
            (courses.error as Error | undefined)?.message ??
            "Could not load priorities."
          }
        />
      </GlassCard>
    );
  }

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
            <li key={p.assignment.id} className="glass-inset flex flex-col gap-2 p-3">
              <div className="flex items-center justify-between gap-3">
                <CompleteToggle
                  done={completed.has(p.assignment.id)}
                  onToggle={() => completed.toggle(p.assignment.id)}
                  label={p.assignment.name}
                  disabled={!completed.ready}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      completed.has(p.assignment.id) && "line-through opacity-60",
                    )}
                  >
                    {p.assignment.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {displayCourseName(p.assignment.course_name, p.assignment.course_code)}
                  </p>
                  <AssignmentDescriptionLink assignmentId={p.assignment.id} className="mt-1" />
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    urgencyClass(p.urgency),
                  )}
                >
                  {p.urgency}
                </span>
              </div>
              <EstimateEditor
                assignmentId={p.assignment.id}
                courseId={p.assignment.course_id}
                minutes={p.estimatedMinutes}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-end">
        <Link
          to="/assignments"
          className="glass-hover inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </GlassCard>
  );
}
