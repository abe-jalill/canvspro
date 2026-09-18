import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  getCoursesFn,
  getAllAssignmentsFn,
  getAnnouncementsFn,
  getCalendarEventsFn,
} from "@/lib/canvas.functions";

const ROUTES = [
  "/dashboard",
  "/focus",
  "/schedule",
  "/class-schedule",
  "/grades",
  "/assignments",
  "/announcements",
  "/billing",
  "/notifications",
  "/settings",
] as const;

const STALE = 5 * 60_000;

/**
 * Warms every authenticated page right after sign-in: route code chunks plus
 * the shared Canvas queries each page reads, so navigation feels instant.
 */
export function useAppPrefetch(enabled = true) {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const warm = async () => {
      // Route chunks and shared data warm in parallel — nothing waits in line.
      await Promise.allSettled([
        ...ROUTES.map((to) => router.preloadRoute({ to }).catch(() => undefined)),
        queryClient.prefetchQuery({
          queryKey: ["canvas", "courses"],
          queryFn: () => getCoursesFn(),
          staleTime: STALE,
        }),
        queryClient.prefetchQuery({
          queryKey: ["canvas", "assignments"],
          queryFn: () => getAllAssignmentsFn(),
          staleTime: STALE,
        }),
        queryClient.prefetchQuery({
          queryKey: ["canvas", "calendar"],
          queryFn: () => getCalendarEventsFn(),
          staleTime: STALE,
        }),
        queryClient.prefetchQuery({
          queryKey: ["canvas", "announcements"],
          queryFn: () => getAnnouncementsFn(),
          staleTime: STALE,
        }),
      ]);
    };

    const idle = setTimeout(warm, 0);
    return () => {
      cancelled = true;
      clearTimeout(idle);
    };
  }, [enabled, router, queryClient]);
}
