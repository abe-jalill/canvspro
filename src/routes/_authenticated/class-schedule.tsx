import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";
import { useClassSchedule } from "@/lib/user-class-schedule";

// Both views are lazy so the timetable UI isn't in the shared first-load bundle.
const ClassScheduleView = lazy(() => import("@/components/class-schedule-view"));
const ClassScheduleEditor = lazy(
  () => import("@/components/class-schedule-editor"),
);

export const Route = createFileRoute("/_authenticated/class-schedule")({
  head: () => ({
    meta: [
      { title: "Class Schedule — Canvas Pro" },
      { name: "description", content: "Add your recurring class meeting times and see them as a clean weekly timetable." },
      { property: "og:title", content: "Class Schedule — Canvas Pro" },
      { property: "og:description", content: "Add your recurring class meeting times and see them as a clean weekly timetable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassSchedulePage,
});

function ClassSchedulePage() {
  const { data, isLoading, error } = useClassSchedule();
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return <div className="glass-panel skeleton-shimmer h-40 rounded-2xl" />;
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
      <Suspense fallback={null}>
        <ClassScheduleEditor
          sessions={sessions}
          onSaved={() => setEditing(false)}
          onCancel={sessions.length > 0 ? () => setEditing(false) : undefined}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <ClassScheduleView sessions={sessions} onEdit={() => setEditing(true)} />
    </Suspense>
  );
}
