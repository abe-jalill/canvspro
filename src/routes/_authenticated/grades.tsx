import { createFileRoute, Link } from "@tanstack/react-router";
import { getGradeColor } from "@/lib/grade-color";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getCoursesFn, getAllAssignmentsFn } from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { displayCourseName } from "@/lib/course-display";
import {
  Search,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronDown,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCourseHighlight, validateCourseSearch } from "@/lib/course-highlight";
import { useGradeSnapshots, useRecordGradeSnapshots } from "@/hooks/use-grade-snapshots";

import {
  coursesQueryOptions as coursesQO,
  assignmentsQueryOptions as assignmentsQO,
} from "@/lib/canvas.queries";
import { CourseGradeCardSkeleton } from "@/components/skeletons/dashboard-skeletons";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { AnimatedNumber } from "@/components/animated-number";

const LEGACY_GRADE_LAYOUT_ENABLED = false;

export const Route = createFileRoute("/_authenticated/grades")({
  head: () => ({
    meta: [
      { title: "Grades — CanvasPro" },
      {
        name: "description",
        content:
          "Per-course grade breakdown across your Canvas assignments, with trends over time.",
      },
      { property: "og:title", content: "Grades — CanvasPro" },
      {
        property: "og:description",
        content:
          "Per-course grade breakdown across your Canvas assignments, with trends over time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: validateCourseSearch,
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(coursesQO);
      void context.queryClient.ensureQueryData(assignmentsQO);
    }
  },
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

  // Classes start collapsed (final grade only); the arrow expands the full list.
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(() => new Set());
  const toggleExpanded = (id: number) =>
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  // Trend = direction of the most recent grade change. Compare the current score
  // to the newest stored snapshot that differs from it, so the arrow persists
  // after the current score is itself recorded as the latest snapshot.
  const trends = useMemo(() => {
    const map = new Map<number, { dir: "up" | "down"; prev: number } | null>();
    const snaps = snapshots.data ?? []; // newest first
    (courses.data ?? []).forEach((c) => {
      const cur = c.current_score;
      if (cur == null) {
        map.set(c.id, null);
        return;
      }
      const prev = snaps.find((s) => s.courseId === c.id && Math.abs(s.score - cur) > 0.05)?.score;
      if (prev == null) map.set(c.id, null);
      else map.set(c.id, { dir: cur > prev ? "up" : "down", prev });
    });
    return map;
  }, [courses.data, snapshots.data]);

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
  const scoredCourses = (courses.data ?? []).filter((course) => course.current_score != null);
  const average = scoredCourses.length
    ? scoredCourses.reduce((sum, course) => sum + (course.current_score ?? 0), 0) /
      scoredCourses.length
    : null;
  const risingCount = scoredCourses.filter((course) => trends.get(course.id)?.dir === "up").length;
  const gradedAssignmentCount = Array.from(byCourse.values()).reduce(
    (count, items) =>
      count +
      items.filter((item) => item.submission?.score != null || item.submission?.grade).length,
    0,
  );

  return (
    <div className="space-y-6">
      <section className="glass-panel-strong premium-reveal relative isolate overflow-hidden rounded-[2rem] border border-primary/15 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Academic performance
            </p>
            <h1 className="mt-2 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
              Your semester, at a glance.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Compare courses, spot movement, and open the details only when you need them.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Current average
              </p>
              <p
                className="mt-1 text-6xl font-medium tabular-nums tracking-[-0.075em]"
                style={{ color: getGradeColor(average) }}
              >
                {average == null ? "—" : <AnimatedNumber value={average} decimals={1} />}
              </p>
            </div>
            {average != null && <span className="mb-2 text-lg text-muted-foreground">%</span>}
          </div>
        </div>
        <div className="relative mt-7 grid grid-cols-3 border-t border-foreground/10 pt-5">
          <div>
            <p className="text-xl font-medium tabular-nums">{scoredCourses.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Courses graded</p>
          </div>
          <div className="border-l border-foreground/10 pl-4">
            <p className="inline-flex items-center gap-1 text-xl font-medium tabular-nums text-primary">
              <TrendingUp className="h-4 w-4" />
              {risingCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Trending up</p>
          </div>
          <div className="border-l border-foreground/10 pl-4">
            <p className="text-xl font-medium tabular-nums">{gradedAssignmentCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">Grades posted</p>
          </div>
        </div>
      </section>

      <div
        className="glass-panel-strong premium-reveal flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ animationDelay: "65ms" }}
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a course or graded assignment"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Search grades"
        />
        <span className="hidden text-xs text-muted-foreground sm:block">
          {filteredCourses.length} courses
        </span>
      </div>

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CourseGradeCardSkeleton key={i} index={i} />
          ))}
        </div>
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

      {!loading && !error && filteredCourses.length > 0 && (
        <section className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCourses.map((course, index) => {
            const trend = trends.get(course.id);
            const expanded = expandedCourses.has(course.id);
            const score = course.current_score;
            const color = getGradeColor(score);
            let items = (byCourse.get(course.id) ?? []).filter(
              (item) => item.submission?.score != null || item.submission?.grade,
            );
            if (q) items = items.filter((item) => item.name.toLowerCase().includes(q));
            const label = displayCourseName(course.name, course.course_code);
            const highlightProps = highlight(label);
            return (
              <div
                key={course.id}
                id={highlightProps.id}
                className={cn(
                  "glass-panel premium-card group overflow-hidden rounded-[1.65rem] border border-foreground/10 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg",
                  highlightProps.className,
                )}
                style={{ animationDelay: `${Math.min(index, 5) * 55 + 90}ms` }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(course.id)}
                  aria-expanded={expanded}
                  className="premium-press relative flex min-h-64 w-full flex-col p-5 text-left transition-colors hover:bg-foreground/[0.02] sm:p-6"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}66` }}
                      />
                      <span className="line-clamp-2 text-sm font-medium leading-snug">{label}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                        expanded && "rotate-180",
                      )}
                    />
                  </div>

                  <div className="mt-8 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                        Current grade
                      </p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span
                          className="text-5xl font-medium tabular-nums tracking-[-0.075em]"
                          style={{ color }}
                        >
                          {fmt(score)}
                        </span>
                        {course.current_grade && (
                          <span className="text-sm font-semibold" style={{ color }}>
                            {course.current_grade}
                          </span>
                        )}
                      </div>
                    </div>
                    {trend ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/[0.04] px-2.5 py-1 text-xs"
                        style={{ color }}
                      >
                        {trend.dir === "up" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                        {Math.abs((score ?? 0) - trend.prev).toFixed(1)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2.5 py-1 text-xs text-muted-foreground">
                        <Minus className="h-3.5 w-3.5" /> Steady
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-8">
                    <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Progress</span>
                      <span>{items.length} graded</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="premium-progress h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${Math.max(0, Math.min(100, score ?? 0))}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="premium-reveal border-t border-foreground/[0.07] bg-foreground/[0.02] px-5 py-4 sm:px-6">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                        Graded work
                      </p>
                      <Link
                        to="/courses/$courseId"
                        params={{ courseId: String(course.id) }}
                        className="text-xs font-medium text-primary hover:opacity-80"
                      >
                        Open course
                      </Link>
                    </div>
                    {items.length === 0 ? (
                      <p className="py-4 text-sm text-muted-foreground">
                        No graded assignments yet.
                      </p>
                    ) : (
                      <ul className="max-h-72 overflow-y-auto pr-1">
                        {items.map((item) => (
                          <li
                            key={item.id}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-t border-foreground/[0.07] py-3 first:border-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm">{item.name}</p>
                              <AssignmentDescriptionLink assignmentId={item.id} className="mt-1" />
                            </div>
                            <p className="text-sm tabular-nums">
                              <span className="font-semibold">{item.submission?.score ?? "—"}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                / {item.points_possible ?? "—"}
                              </span>
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {LEGACY_GRADE_LAYOUT_ENABLED &&
        !loading &&
        !error &&
        filteredCourses.map((c) => {
          const trend = trends.get(c.id);
          const expanded = expandedCourses.has(c.id);
          const score = c.current_score;
          const color = getGradeColor(score);
          let items = (byCourse.get(c.id) ?? []).filter(
            (a) => a.submission?.score != null || a.submission?.grade,
          );
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
                    <span className="font-normal text-foreground">
                      {displayCourseName(c.name, c.course_code)}
                    </span>
                  </Link>
                }
                action={
                  <span className="flex items-center gap-1.5">
                    <span
                      className="flex items-center gap-1.5 text-base font-normal tabular-nums"
                      style={{ color }}
                    >
                      {trend?.dir === "up" && (
                        <span title={`Previously ${trend.prev.toFixed(1)}%`} className="flex">
                          <ArrowUp className="h-4 w-4" style={{ color }} aria-label="Grade up" />
                        </span>
                      )}
                      {trend?.dir === "down" && (
                        <span title={`Previously ${trend.prev.toFixed(1)}%`} className="flex">
                          <ArrowDown
                            className="h-4 w-4 opacity-70"
                            style={{ color }}
                            aria-label="Grade down"
                          />
                        </span>
                      )}
                      {trend == null && (
                        <Minus
                          className="h-4 w-4 text-muted-foreground"
                          aria-label="No grade change"
                        />
                      )}
                      {fmt(c.current_score)}
                      {c.current_grade ? (
                        <span className="ml-1.5 text-sm font-normal opacity-85" style={{ color }}>
                          {c.current_grade}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(c.id)}
                      aria-expanded={expanded}
                      aria-label={
                        expanded
                          ? `Hide grades for ${displayCourseName(c.name, c.course_code)}`
                          : `Show grades for ${displayCourseName(c.name, c.course_code)}`
                      }
                      className="glass-hover flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          !expanded && "-rotate-90",
                        )}
                      />
                    </button>
                  </span>
                }
              >
                {expanded &&
                  (items.length === 0 ? (
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
                  ))}
              </GlassCard>
            </div>
          );
        })}
    </div>
  );
}
