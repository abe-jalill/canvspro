import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { CanvasKeyGate } from "@/components/canvas-key-gate";

// Live weekly timetable derived from the user's own Canvas calendar.
const CanvasClassSchedule = lazy(
  () => import("@/components/canvas-class-schedule"),
);

export const Route = createFileRoute("/_authenticated/class-schedule")({
  head: () => ({
    meta: [
      { title: "Class Schedule — Canvas Pro" },
      { name: "description", content: "Your weekly recurring class meeting times and locations, pulled live from Canvas." },
      { property: "og:title", content: "Class Schedule — Canvas Pro" },
      { property: "og:description", content: "Your weekly recurring class meeting times and locations, pulled live from Canvas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassSchedulePage,
});

function ClassSchedulePage() {
  return (
    <CanvasKeyGate>
      <Suspense fallback={null}>
        <CanvasClassSchedule />
      </Suspense>
    </CanvasKeyGate>
  );
}
