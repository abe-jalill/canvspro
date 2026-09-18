import { createFileRoute, Link } from "@tanstack/react-router";
import { getGradeColor } from "@/lib/grade-color";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getCoursesFn, getAllAssignmentsFn } from "@/lib/canvas.functions";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { displayCourseName } from "@/lib/course-display";
import { Search, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useCourseHighlight, validateCourseSearch } from "@/lib/course-highlight";
import { useGradeSnapshots, useRecordGradeSnapshots } from "@/hooks/use-grade-snapshots";

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

export const Route = createFileRoute("/_authenticated/grades")({
  head: () => ({
    meta: [
      { title: "Grades — Canvas Pro" },
      {
        name: "description",
        content: "Per-course grade breakdown across your Canvas assignments, with trends over time.",
      },
      { property: "og:title", content: "Grades — Canvas Pro" },
      {
        property: "og:description",
        content: "Per-course grade breakdown across your Canvas assignments, with trends over time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: validateCourseSearch,
  component: GradesPage,
});

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

function GradesPage() {
  const courses = useQuery(coursesQO);
  const assignments = useQuery(assignmentsQO);
  const [search, setSearch] = useState("");
  const snapshots = useGradeSnapshots();
  const record = useRecordGradeSnapshots();
  const highlight = useCourseHighlight();

  const loading = courses.isLoading || assignments.isLoading || snapshots.isLoading;
  const error = courses.error || assignments.error || snapshots.error;

  // Latest snapshot per course, if any.
  const latestByCourse = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of snapshots.data ?? []) {
      if (!map.has(s.courseId)) map.set(s.courseId, s.score);
    }
    return map;
  }, [snapshots.data]);

  // Compute trend by comparing current score to the most recent stored snapshot.
  const trends = useMemo(() => {
    const map = new Map<number, "up" | "down" | null>();
    (courses.data ?? []).forEach((c) => {
      if (c.current_score == null) {
        map.set(c.id, null);
        return;
      }
      const prev = latestByCourse.get(c.id);
      if (prev == null) map.set(c.id, null);
      else if (c.current_score > prev + 0.05) map.set(c.id, "up");
      else if (c.current_score < prev - 0.05) map.set(c.id, "down");
      else map.set(c.id, null);
    });
    return map;
  }, [courses.data, latestByCourse]);

  // Record snapshots for any course whose current score differs from latest.
  useEffect(() => {
    if (!courses.data || !snapshots.isSuccess) return;
    const toRecord = courses.data
      .filter((c) => c.current_score != null)
      .filter((c) => latestByCourse.get(c.id) !== c.current_score)
      .map((c) => ({ courseId: c.id, score: c.current_score! }));
    if (toRecord.length > 0) record.mutate(toRecord);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses.data, snapshots.isSuccess]);

  type AssignmentItem = NonNullable<typeof assignments.data>[number];
  const byCourse = new Map<number, AssignmentItem[]>();
  (assignments.data ?? []).forEach((a) => {
    const arr = byCourse.get(a.course_id) ?? [];
    arr.push(a);
    byCourse.set(a.course_id, arr);
  });

  const q = search.trim().toLowerCase();
  const filteredCourses = (courses.data ?? []).filter((c) => {
    if (!q) return true;
    const displayName = displayCourseName(c.name, c.course_code).toLowerCase();
    if (displayName.includes(q) || c.name.toLowerCase().includes(q)) return true;
    // Match if any of this course's assignments matches search
    const items = byCourse.get(c.id) ?? [];
    return items.some((a) => a.name.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <header className="px-1 pt-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Per course</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Grades</h1>
      </header>

      <div className="glass-panel-strong flex items-center gap-2 px-4 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search courses or assignments…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Search grades"
        />
      </div>

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
      {!loading && !error && (courses.data?.length ?? 0) > 0 && filteredCourses.length === 0 && (
        <GlassCard>
          <EmptyState message="No matching assignments found." />
        </GlassCard>
      )}

      {!loading &&
        !error &&
        filteredCourses.map((c) => {
          const trend = trends.get(c.id);
          const score = c.current_score;
          const color = getGradeColor(score);
          let items = (byCourse.get(c.id) ?? []).filter((a) => a.submission?.score != null || a.submission?.grade);
          if (q) items = items.filter((a) => a.name.toLowerCase().includes(q));

          return (
            <div key={c.id} {...highlight(displayCourseName(c.name, c.course_code))}>
              <GlassCard
                title={
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: String(c.id) }}
                    className="flex items-center gap-2.5 group hover:opacity-90 transition-opacity"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: color,
                        boxShadow: `0 0 8px ${color}66`,
                      }}
                    />
                    <span className="font-normal text-foreground">{displayCourseName(c.name, c.course_code)}</span>
                  </Link>
                }
                action={
                  <span className="flex items-center gap-1.5 text-base font-normal tabular-nums" style={{ color }}>
                    {trend === "up" && <ArrowUp className="h-4 w-4" style={{ color }} aria-label="Grade up" />}
                    {trend === "down" && (
                      <ArrowDown className="h-4 w-4 opacity-70" style={{ color }} aria-label="Grade down" />
                    )}
                    {trend == null && <Minus className="h-4 w-4 text-muted-foreground" aria-label="No grade change" />}
                    {fmt(c.current_score)}
                    {c.current_grade ? (
                      <span className="ml-1.5 text-sm font-normal opacity-85" style={{ color }}>
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
                      <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                        <p className="min-w-0 truncate text-sm">{a.name}</p>
                        <div className="whitespace-nowrap text-sm tabular-nums">
                          <span className="font-semibold">{a.submission?.score ?? "—"}</span>
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
            </div>
          );
        })}
    </div>
  );
}
