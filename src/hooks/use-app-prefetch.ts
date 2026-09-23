import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  getCoursesFn,
  getAllAssignmentsFn,
  getAnnouncementsFn,
  getCalendarEventsFn,
} from "@/lib/canvas.functions";
import { canvasKeyQueryKey, fetchHasCanvasKey } from "@/lib/user-settings";
import { fetchUserPreferences, userPreferencesQueryKey } from "@/hooks/use-user-preferences";
import { fetchUserProfile } from "@/lib/user-profile";
import { useUserScope } from "@/lib/user-scope";
import { userKey } from "@/lib/auth-user";
import { getSubscriptionAccess } from "@/lib/subscription.functions";

const ROUTES = [
  "/dashboard",
  "/assignments",
  "/focus",
  "/study-session",
  "/schedule",
  "/grades",
  "/announcements",
  "/class-schedule",
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
        staleTime: 5 * 60_000,
        revalidateIfStale: true,
      }),
      client.ensureQueryData({
        queryKey: ["canvas", "assignments"],
        queryFn: getAllAssignmentsFn,
        staleTime: 5 * 60_000,
        revalidateIfStale: true,
      }),
      client.ensureQueryData({
        queryKey: ["canvas", "calendar"],
        queryFn: getCalendarEventsFn,
        staleTime: 5 * 60_000,
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

    void Promise.all([
      delay(MINIMUM_WELCOME_MS),
      Promise.race([critical, delay(CRITICAL_CAP_MS)]),
    ]).then(() => {
      if (!cancelled) setStatus("ready");
    });

    // Secondary data and likely-next route chunks never hold the welcome screen.
    const timer = window.setTimeout(() => {
      void Promise.allSettled([
        client.prefetchQuery({
          queryKey: ["canvas", "announcements"],
          queryFn: getAnnouncementsFn,
          staleTime: 5 * 60_000,
        }),
        client.prefetchQuery({
          queryKey: userKey(userPreferencesQueryKey, scope),
          queryFn: ({ signal }) => fetchUserPreferences(signal),
          staleTime: 60_000,
        }),
        ...ROUTES.map((to) => router.preloadRoute({ to }).catch(() => undefined)),
      ]);
    }, 350);
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
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, scope, router, client]);

  return status;
}
