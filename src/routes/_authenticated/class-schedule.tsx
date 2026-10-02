import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClassSchedule } from "@/lib/user-class-schedule";
import { coursesQueryOptions } from "@/lib/canvas.queries";
import { matchScheduleCourse } from "@/lib/class-schedule";
import { displayCourseNameForCourse } from "@/lib/course-display";

// Both views are lazy so the timetable UI isn't in the shared first-load bundle.
const ClassScheduleView = lazy(() => import("@/components/class-schedule-view"));
const ClassScheduleEditor = lazy(() => import("@/components/class-schedule-editor"));

function ScheduleSkeleton() {
  return (
    <div role="status" aria-label="Loading class schedule" className="glass-panel space-y-4 p-6">
      <div className="skeleton-shimmer h-6 w-40" />
      <div className="skeleton-shimmer h-32 w-full rounded-2xl" />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/class-schedule")({
  head: () => ({
    meta: [
      { title: "Class Schedule — CanvasPro" },
      {
        name: "description",
        content: "Add your recurring class meeting times and see them as a clean weekly timetable.",
      },
      { property: "og:title", content: "Class Schedule — CanvasPro" },
      {
        property: "og:description",
        content: "Add your recurring class meeting times and see them as a clean weekly timetable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassSchedulePage,
});

function ClassSchedulePage() {
  const { data, isLoading, error } = useClassSchedule();
  const courses = useQuery(coursesQueryOptions);
  const [editing, setEditing] = useState(false);
  // Show each class under the same name used on every other page (including
  // any rename from Settings), falling back to the title typed in the editor.
  const named = useMemo(() => {
    const list = (courses.data ?? []).map((course) => ({
      ...course,
      display: displayCourseNameForCourse(course.id, course.name, course.course_code),
    }));
    return (data ?? []).map((session) => {
      const course = matchScheduleCourse(session.title, session.code, list);
      return course
        ? {
            ...session,
            displayName: course.display,
          }
        : session;
    });
  }, [data, courses.data]);

  if (isLoading) {
    return <ScheduleSkeleton />;
  }

  if (error) {
    return (
      <div className="glass-panel-strong p-6">
        <h1 className="text-xl font-semibold tracking-tight">Class Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Couldn't load your schedule. Please try again.
        </p>
      </div>
    );
  }

  const sessions = data ?? [];

  if (editing || sessions.length === 0) {
    return (
      <Suspense fallback={<ScheduleSkeleton />}>
        <ClassScheduleEditor
          sessions={sessions}
          onSaved={() => setEditing(false)}
          onCancel={sessions.length > 0 ? () => setEditing(false) : undefined}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <ClassScheduleView sessions={named} onEdit={() => setEditing(true)} />
    </Suspense>
  );
}
