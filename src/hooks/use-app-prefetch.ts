import { ACCOUNT_REFRESH_INTERVAL_MS, refreshAccountQueries } from "@/lib/account-refresh";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  getCoursesFn,
  getAllAssignmentsFn,
  getAnnouncementsFn,
  getCalendarEventsFn,
} from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { canvasKeyQueryKey, fetchHasCanvasKey } from "@/lib/user-settings";
import { fetchUserPreferences, userPreferencesQueryKey } from "@/hooks/use-user-preferences";
import { fetchUserProfile } from "@/lib/user-profile";
import { useUserScope } from "@/lib/user-scope";
import { userKey } from "@/lib/auth-user";

const PRIMARY_ROUTES = [
  "/dashboard",
  "/get-it-done",
  "/assignments",
  "/focus",
  "/schedule",
  "/grades",
] as const;

const SECONDARY_ROUTES = [
  "/study-session",
  "/announcements",
  "/class-schedule",
  "/notifications",
  "/settings",
] as const;

const MINIMUM_WELCOME_MS = 150;
const CRITICAL_CAP_MS = 1_500;
const REFRESH_COOLDOWN_MS = 30_000;

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
    ]);

    const launchReady = Promise.all([
      delay(MINIMUM_WELCOME_MS),
      Promise.race([critical, delay(CRITICAL_CAP_MS)]),
    ]);

    let cancelIdle: () => void = () => {};
    // Never preload while the router is still resolving the page on screen:
    // a preload of the same route clears its pending promise and the page
    // crashes with "Uncaught undefined". Also skip the page already open.
    const routerIdle = () =>
      new Promise<void>((resolve) => {
        const check = () => router.state.status === "idle" && !router.state.isLoading;
        if (check()) return resolve();
        const iv = window.setInterval(() => {
          if (cancelled || check()) {
            window.clearInterval(iv);
            resolve();
          }
        }, 100);
      });
    const warmRoute = (to: string) =>
      router.state.location.pathname === to
        ? Promise.resolve(undefined)
        : router.preloadRoute({ to } as never).catch(() => undefined);

    void launchReady.then(async () => {
      if (cancelled) return;
      setStatus("ready");
      await routerIdle();
      if (cancelled) return;

      // These destinations make up the app's primary navigation loop.
      // Their code is requested as soon as launch-critical data is ready, but
      // it never delays the dashboard becoming interactive.
      const primaryWarm = Promise.allSettled(PRIMARY_ROUTES.map(warmRoute));

      // Wait until the browser has painted the dashboard before fetching
      // lower-priority data and chunks.
      const warmSecondary = () => {
        if (cancelled) return;
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
          ...SECONDARY_ROUTES.map(warmRoute),
        ]);
      };

      void primaryWarm.then(() => {
        if (cancelled) return;
        const idleCallback = (
          window as unknown as {
            requestIdleCallback?: Window["requestIdleCallback"];
          }
        ).requestIdleCallback;
        if (idleCallback) {
          const idleId = idleCallback.call(window, warmSecondary, { timeout: 2_500 });
          cancelIdle = () => window.cancelIdleCallback(idleId);
        } else {
          const timer = window.setTimeout(warmSecondary, 1_000);
          cancelIdle = () => window.clearTimeout(timer);
        }
      });
    });
    let lastRefreshAt = 0;
    let lastCanvasRefreshAt = 0;
    const refresh = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      const now = Date.now();
      if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) return;
      lastRefreshAt = now;
      if (now - lastCanvasRefreshAt >= 5 * 60_000) {
        lastCanvasRefreshAt = now;
        void client.refetchQueries(
          { queryKey: ["canvas"], type: "active", stale: true },
          { cancelRefetch: false },
        );
      }
      // Changes made on another device should appear when this one becomes
      // active again. Keep existing cache visible while these refresh.
      void refreshAccountQueries(client);
      window.dispatchEvent(new Event("canvaspro:refresh-account"));
    };
    const interval = setInterval(refresh, ACCOUNT_REFRESH_INTERVAL_MS);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      cancelIdle();
      clearInterval(interval);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, scope, router, client]);

  return status;
}
