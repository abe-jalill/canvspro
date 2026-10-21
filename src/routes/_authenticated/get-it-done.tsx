import { createFileRoute, redirect } from "@tanstack/react-router";

// Get It Done is now Today's Next up: its one suggestion, with Start. Old links,
// bookmarks and notifications land there.
export const Route = createFileRoute("/_authenticated/get-it-done")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
