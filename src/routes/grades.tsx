import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { getCoursesFn, getAllAssignmentsFn } from "@/lib/canvas.functions";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { displayCourseName, displayCourseCode } from "@/lib/course-display";

const coursesQO = queryOptions({
  queryKey: ["canvas", "courses"],
  queryFn: () => getCoursesFn(),
  staleTime: 5 * 60_000,
});

const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/grades")({
  head: () => ({
    meta: [
      { title: "Grades — Canvas Student" },
      {
        name: "description",
        content: "Per-course grade breakdown across your Canvas assignments.",
      },
    ],
  }),
  component: GradesPage,
});

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

function GradesPage() {
  const courses = useQuery(coursesQO);
  const assignments = useQuery(assignmentsQO);

  const loading = courses.isLoading || assignments.isLoading;
  const error = courses.error || assignments.error;

  type AssignmentItem = NonNullable<typeof assignments.data>[number];
  const byCourse = new Map<number, AssignmentItem[]>();
  (assignments.data ?? []).forEach((a) => {
    const arr = byCourse.get(a.course_id) ?? [];
    arr.push(a);
    byCourse.set(a.course_id, arr);
  });

  return (
    <div className="space-y-6">
      <header className="px-1 pt-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Per course
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Grades
        </h1>
      </header>

      {loading && (
        <GlassCard>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </GlassCard>
      )}
      {error && (
        <GlassCard>
          <ErrorState message={(error as Error).message} />
        </GlassCard>
      )}
      {!loading && !error && (courses.data?.length ?? 0) === 0 && (
        <GlassCard>
          <EmptyState message="No active courses." />
        </GlassCard>
      )}

      {!loading && !error && (courses.data ?? []).map((c) => {
        const items = (byCourse.get(c.id) ?? []).filter(
          (a) => a.submission?.score != null || a.submission?.grade,
        );
        return (
          <GlassCard
            key={c.id}
            title={displayCourseName(c.name, c.course_code)}
            subtitle={
              displayCourseCode(c.name, c.course_code) === displayCourseName(c.name, c.course_code)
                ? c.course_code
                : c.name
            }
            action={
              <span className="text-lg font-semibold tabular-nums">
                {fmt(c.current_score)}
                {c.current_grade ? (
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    {c.current_grade}
                  </span>
                ) : null}
              </span>
            }
          >
            {items.length === 0 ? (
              <EmptyState message="No graded assignments yet." />
            ) : (
              <ul className="divide-y divide-foreground/10">
                {items.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <p className="min-w-0 truncate text-sm">{a.name}</p>
                    <div className="whitespace-nowrap text-sm tabular-nums">
                      <span className="font-semibold">
                        {a.submission?.score ?? "—"}
                      </span>
                      <span className="text-muted-foreground">
                        {" / "}
                        {a.points_possible ?? "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
