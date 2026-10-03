import type { QueryClient } from "@tanstack/react-query";
import { reopenedAssignmentTimes } from "./completion-records.ts";
import { setReopenedAssignments } from "./assignment-window.ts";

/**
 * Keeps the "reopened" overrides (work marked not done although Canvas shows it
 * as submitted) in step with the saved preferences. The cache is updated before
 * any component re-renders, so every list sees the same answer on the same
 * render. Browser only: this is per-account state and must never live on a server.
 */
export function watchReopenedAssignments(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryKey[0] !== "user-preferences") return;
    if (event.type === "removed") {
      setReopenedAssignments(new Map());
      return;
    }
    const data = event.query.state.data as Record<string, unknown> | undefined;
    if (data) setReopenedAssignments(reopenedAssignmentTimes(data));
  });
}
