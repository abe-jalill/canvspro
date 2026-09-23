import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  getCoursesFn,
  getAllAssignmentsFn,
  getAnnouncementsFn,
  getCalendarEventsFn,
  type CourseSummary,
} from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { canvasKeyQueryKey, fetchHasCanvasKey } from "@/lib/user-settings";
import { fetchUserPreferences, userPreferencesQueryKey } from "@/hooks/use-user-preferences";
import { fetchUserProfile } from "@/lib/user-profile";
import { useUserScope } from "@/lib/user-scope";
import { userKey } from "@/lib/auth-user";
import { getSubscriptionAccess } from "@/lib/subscription.functions";

const PRIMARY_ROUTES = ["/dashboard", "/assignments", "/focus", "/schedule", "/grades"] as const;

const SECONDARY_ROUTES = [
  "/study-session",
  "/announcements",
  "/class-schedule",
  "/billing",
  "/notifications",
  "/settings",
] as const;

const MINIMUM_WELCOME_MS = 900;
const CRITICAL_CAP_MS = 4_000;

export type AppStartupStatus = "loading" | "ready";

/** Warm launch-critical data first; all speculative work remains background-only. */
export function useAppPrefetch(enabled = true): AppStartupStatus {
  const router = useRouter();
  const client = useQueryClient();
  const scope = useUserScope();
  const [status, setStatus] = useState<AppStartupStatus>(enabled ? "loading" : "ready");

  useEffect(() => {
    if (!enabled || !scope) {
      setStatus("ready");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    const critical = Promise.allSettled([
      client.ensureQueryData({
        queryKey: ["canvas", "courses"],
        queryFn: getCoursesFn,
        staleTime: CANVAS_DATA_STALE_MS,
        gcTime: CANVAS_DATA_GC_MS,
        revalidateIfStale: true,
      }),
      client.ensureQueryData({
        queryKey: ["canvas", "assignments"],
        queryFn: getAllAssignmentsFn,
        staleTime: CANVAS_DATA_STALE_MS,
        gcTime: CANVAS_DATA_GC_MS,
        revalidateIfStale: true,
      }),
      client.ensureQueryData({
        queryKey: ["canvas", "calendar"],
        queryFn: getCalendarEventsFn,
        staleTime: CANVAS_DATA_STALE_MS,
        gcTime: CANVAS_DATA_GC_MS,
        revalidateIfStale: true,
      }),
      client.ensureQueryData({
        queryKey: canvasKeyQueryKey,
        queryFn: fetchHasCanvasKey,
        staleTime: 60_000,
        revalidateIfStale: true,
      }),
      client.ensureQueryData({
        queryKey: ["user-profile"],
        queryFn: fetchUserProfile,
        staleTime: 60_000,
        revalidateIfStale: true,
      }),
      client.ensureQueryData({
        queryKey: userKey(["subscription"], scope),
        queryFn: getSubscriptionAccess,
        staleTime: 60_000,
        revalidateIfStale: true,
      }),
    ]);

    const launchReady = Promise.all([
      delay(MINIMUM_WELCOME_MS),
      Promise.race([critical, delay(CRITICAL_CAP_MS)]),
    ]);

    let cancelIdle = () => undefined;
    void launchReady.then(() => {
      if (cancelled) return;
      setStatus("ready");

      // These five destinations make up the app's primary navigation loop.
      // Their code is requested as soon as launch-critical data is ready, but
      // it never delays the dashboard becoming interactive.
      const primaryWarm = Promise.allSettled(
        PRIMARY_ROUTES.map((to) => router.preloadRoute({ to }).catch(() => undefined)),
      );

      // Wait until the browser has painted the dashboard before fetching
      // lower-priority data and chunks.
      const warmSecondary = () => {
        if (cancelled) return;
        const courses = client.getQueryData<CourseSummary[]>(["canvas", "courses"]) ?? [];
        void Promise.allSettled([
          client.prefetchQuery({
            queryKey: ["canvas", "announcements"],
            queryFn: getAnnouncementsFn,
            staleTime: CANVAS_DATA_STALE_MS,
            gcTime: CANVAS_DATA_GC_MS,
          }),
          client.prefetchQuery({
            queryKey: userKey(userPreferencesQueryKey, scope),
            queryFn: ({ signal }) => fetchUserPreferences(signal),
            staleTime: 60_000,
          }),
          ...SECONDARY_ROUTES.map((to) => router.preloadRoute({ to }).catch(() => undefined)),
          ...courses.map((course) =>
            router
              .preloadRoute({
                to: "/courses/$courseId",
                params: { courseId: String(course.id) },
              })
              .catch(() => undefined),
          ),
        ]);
      };

      void primaryWarm.then(() => {
        if (cancelled) return;
        if ("requestIdleCallback" in window) {
          const idleId = window.requestIdleCallback(warmSecondary, { timeout: 1_500 });
          cancelIdle = () => window.cancelIdleCallback(idleId);
        } else {
          const timer = window.setTimeout(warmSecondary, 500);
          cancelIdle = () => window.clearTimeout(timer);
        }
      });
    });
    const refresh = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      void client.refetchQueries(
        { queryKey: ["canvas"], type: "active", stale: true },
        { cancelRefetch: false },
      );
    };
    const interval = setInterval(refresh, 5 * 60_000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      cancelIdle();
      clearInterval(interval);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, scope, router, client]);

  return status;
}
