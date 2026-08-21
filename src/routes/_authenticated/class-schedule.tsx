import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// The static weekly schedule is personal data belonging to this account.
const OWNER_USER_ID = "0a0857b8-3e9a-466e-8b40-9cd32d338850";

// Loaded only after ownership is confirmed, so the timetable is not part of
// the bundle every signed-in user downloads.
const OwnerClassSchedule = lazy(() => import("@/components/owner-class-schedule"));

export const Route = createFileRoute("/_authenticated/class-schedule")({
  head: () => ({
    meta: [
      { title: "Class Schedule — Canvas Pro" },
      { name: "description", content: "Your weekly recurring class meeting times and locations for the Fall 2026 semester." },
      { property: "og:title", content: "Class Schedule — Canvas Pro" },
      { property: "og:description", content: "Your weekly recurring class meeting times and locations for the Fall 2026 semester." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassSchedulePage,
});

function ClassSchedulePage() {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setIsOwner(data.user?.id === OWNER_USER_ID);
    });
    return () => {
      active = false;
    };
  }, []);

  if (isOwner === null) return null;
  if (!isOwner) {
    return (
      <div className="glass-panel-strong p-6">
        <h1 className="text-xl font-semibold tracking-tight">Class Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This weekly class-time schedule is personal to its owner. Your own
          Canvas courses, grades, and assignments appear on the other pages.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <OwnerClassSchedule />
    </Suspense>
  );
}
