import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { getCoursesFn, getAllAssignmentsFn, getAnnouncementsFn, getCalendarEventsFn } from "@/lib/canvas.functions";
import { canvasKeyQueryKey, fetchHasCanvasKey } from "@/lib/user-settings";
import { fetchUserPreferences, userPreferencesQueryKey } from "@/hooks/use-user-preferences";
import { fetchUserProfile } from "@/lib/user-profile";
import { useUserScope } from "@/lib/user-scope";
import { userKey } from "@/lib/auth-user";

const ROUTES = ["/dashboard", "/assignments", "/focus", "/study-session", "/schedule", "/grades", "/announcements", "/class-schedule"] as const;

/** Refresh shared data once per account visit without blocking the app shell. */
export function useAppPrefetch(enabled = true) {
  const router = useRouter();
  const client = useQueryClient();
  const scope = useUserScope();
  useEffect(() => {
    if (!enabled || !scope) return;
    const data = [
      client.prefetchQuery({ queryKey: ["canvas", "courses"], queryFn: getCoursesFn, staleTime: 0 }),
      client.prefetchQuery({ queryKey: ["canvas", "assignments"], queryFn: getAllAssignmentsFn, staleTime: 0 }),
      client.prefetchQuery({ queryKey: ["canvas", "announcements"], queryFn: getAnnouncementsFn, staleTime: 0 }),
      client.prefetchQuery({ queryKey: ["canvas", "calendar"], queryFn: getCalendarEventsFn, staleTime: 0 }),
      client.prefetchQuery({ queryKey: canvasKeyQueryKey, queryFn: fetchHasCanvasKey, staleTime: 0 }),
      client.prefetchQuery({ queryKey: userKey(userPreferencesQueryKey, scope), queryFn: ({ signal }) => fetchUserPreferences(signal), staleTime: 60_000 }),
      client.prefetchQuery({ queryKey: ["user-profile"], queryFn: fetchUserProfile, staleTime: 0 }),
    ];
    void Promise.allSettled(data);
    // Let the current route paint before loading likely next destinations.
    const timer = setTimeout(() => {
      void Promise.allSettled(ROUTES.map((to) => router.preloadRoute({ to })));
    }, 400);
    const refresh = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      void client.refetchQueries({ queryKey: ["canvas"], type: "active", stale: true }, { cancelRefetch: false });
    };
    const interval = setInterval(refresh, 5 * 60_000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, scope, router, client]);
}
