import { createFileRoute, redirect } from "@tanstack/react-router";

// Notification settings live in one place: Settings → Notifications.
// This path is kept so old links and bookmarks still land there.
export const Route = createFileRoute("/_authenticated/notifications")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/notifications", replace: true });
  },
});
