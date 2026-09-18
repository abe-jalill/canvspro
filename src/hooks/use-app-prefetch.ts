import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  getCoursesFn,
  getAllAssignmentsFn,
  getAnnouncementsFn,
  getCalendarEventsFn,
} from "@/lib/canvas.functions";
import { scopedKey } from "@/lib/user-scope";

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
const WARM_CAP_MS = 8_000;
const WARMED_BASE_KEY = "app-warmed";

function alreadyWarmed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(scopedKey(WARMED_BASE_KEY)) === "1";
  } catch {
    return false;
  }
}

function markWarmed() {
  try {
    window.sessionStorage.setItem(scopedKey(WARMED_BASE_KEY), "1");
  } catch {
    // ignore
  }
}

export type WarmupStatus = "warming" | "ready";

/**
 * Warms every authenticated page right after sign-in: route code chunks plus
 * the shared Canvas queries each page reads, so navigation feels instant.
 * Returns "warming" until the first warm-up of the session completes (capped).
 */
export function useAppPrefetch(enabled = true): WarmupStatus {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<WarmupStatus>(() =>
    !enabled || alreadyWarmed() ? "ready" : "warming",
  );

  useEffect(() => {
    if (!enabled) {
      setStatus("ready");
      return;
    }
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      markWarmed();
      setStatus("ready");
    };

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
      finish();
    };

    const idle = setTimeout(warm, 0);
    // Never strand the user on the splash if Canvas is slow or failing.
    const cap = setTimeout(finish, WARM_CAP_MS);
    return () => {
      cancelled = true;
      clearTimeout(idle);
      clearTimeout(cap);
    };
  }, [enabled, router, queryClient]);

  return status;
}
