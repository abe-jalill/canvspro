import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";
import { assignmentsQueryOptions, coursesQueryOptions } from "@/lib/canvas.queries";
import { displayCourseName } from "@/lib/course-display";
import { getGradeBg, getGradeColor } from "@/lib/grade-color";
import { gradedAgo, newGrades } from "@/lib/new-grades";
import { ErrorState } from "@/components/glass-card";
import { SkeletonBlock } from "@/components/skeletons/dashboard-skeletons";

export const Route = createFileRoute("/_authenticated/new-grades")({
  head: () => ({
    meta: [
      { title: "New grades — CoursePro" },
      { name: "description", content: "Grades from the past 24 hours, newest first." },
    ],
  }),
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(assignmentsQueryOptions);
      void context.queryClient.ensureQueryData(coursesQueryOptions);
    }
  },
  component: NewGradesPage,
});

/** A page of its own (no sidebar), opened from Grades. */
function NewGradesPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const assignments = useQuery(assignmentsQueryOptions);
  const courses = useQuery(coursesQueryOptions);
  const [now, setNow] = useState(() => Date.now());

  // "3 hr ago" stays right, and a grade drops off once it's a day old.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const courseById = new Map((courses.data ?? []).map((course) => [course.id, course]));
  const entries = newGrades(assignments.data ?? [], now);
  const goBack = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: "/grades" });
  };

  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <header className="mb-6 flex items-center gap-3 py-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-foreground transition-colors hover:border-foreground/40"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 text-xl font-medium tracking-tight">New grades</h1>
        <span className="shrink-0 text-sm text-muted-foreground">Past 24 hours</span>
      </header>

      {assignments.isLoading ? (
        <div className="space-y-3 px-1" role="status" aria-label="Loading new grades">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : assignments.isError ? (
        <ErrorState message={(assignments.error as Error).message} />
      ) : entries.length === 0 ? (
        <div className="px-1 py-24 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-base">No new grades.</p>
        </div>
      ) : (
        <ul className="space-y-2 px-1">
          {entries.map(({ assignment: a, at }) => {
            const course = courseById.get(a.course_id);
            const score = a.submission?.score;
            const percent =
              score != null && a.points_possible ? (score / a.points_possible) * 100 : null;
            const color = getGradeColor(percent);
            return (
              <li key={a.id}>
                <Link
                  to="/courses/$courseId"
                  params={{ courseId: String(a.course_id) }}
                  search={{ assignment: String(a.id) }}
                  className="press group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3.5 rounded-lg border border-foreground/15 px-4 py-3.5 transition-colors hover:border-foreground/30"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] leading-snug">{a.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {displayCourseName(
                        course?.name ?? a.course_name,
                        course?.course_code ?? a.course_code,
                      )}{" "}
                      · {gradedAgo(at, now)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap text-sm tabular-nums">
                    <span>
                      <span className="font-semibold">{score ?? a.submission?.grade ?? "—"}</span>
                      {a.points_possible != null && (
                        <span className="text-muted-foreground"> / {a.points_possible}</span>
                      )}
                    </span>
                    {percent != null && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ color, backgroundColor: getGradeBg(percent, 0.14) }}
                      >
                        {Math.round(percent)}%
                      </span>
                    )}
                  </div>
                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
