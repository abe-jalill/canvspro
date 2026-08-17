import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

// Built live from the signed-in user's own Canvas calendar.
const LiveClassSchedule = lazy(() => import("@/components/live-class-schedule"));

export const Route = createFileRoute("/_authenticated/class-schedule")({
  head: () => ({
    meta: [
      { title: "Class Schedule — Canvas Pro" },
      { name: "description", content: "Your weekly recurring class meeting times and locations, built from your live Canvas calendar." },
      { property: "og:title", content: "Class Schedule — Canvas Pro" },
      { property: "og:description", content: "Your weekly recurring class meeting times and locations, built from your live Canvas calendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassSchedulePage,
});

function ClassSchedulePage() {
  return (
    <Suspense fallback={null}>
      <LiveClassSchedule />
    </Suspense>
  );
}
