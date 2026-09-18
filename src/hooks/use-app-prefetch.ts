import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  getCoursesFn,
  getAllAssignmentsFn,
  getAnnouncementsFn,
  getCalendarEventsFn,
  type CourseSummary,
} from "@/lib/canvas.functions";
import { fetchUserProfile } from "@/lib/user-profile";
import { fetchClassSchedule } from "@/lib/user-class-schedule";

/** Primary routes prioritized for immediate preloading right after dashboard loads */
const PRIMARY_ROUTES = ["/assignments", "/grades", "/schedule", "/focus"] as const;

/** Secondary routes prefetched during browser idle time */
const SECONDARY_ROUTES = ["/class-schedule", "/announcements", "/settings", "/notifications", "/billing"] as const;

const QUERY_STALE_TIME = 5 * 60_000; // 5 minutes
const USER_DATA_STALE_TIME = 60_000; // 1 minute

/**
 * Warms all authenticated pages and data queries right after sign-in:
 *
 * 1. Defers warming until after the dashboard finishes initial paint (via requestIdleCallback).
 * 2. Preloads high-priority routes and core Canvas data in parallel.
 * 3. Preloads secondary routes and account settings during idle cycles.
 * 4. Automatically warms dynamic `/courses/$courseId` pages for every enrolled class.
 * 5. Runs once per session to avoid redundant network overhead.
 * 6. Respects user's `Save-Data` preference on constrained mobile networks.
 */
export function useAppPrefetch(enabled = true) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasWarmedRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasWarmedRef.current) return;

    // Respect Data Saver mode on mobile devices
    if (
      typeof navigator !== "undefined" &&
      "connection" in navigator &&
      (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData
    ) {
      return;
    }

    let cancelled = false;
    hasWarmedRef.current = true;

    const preloadCoursePages = (courseList: CourseSummary[]) => {
      if (!Array.isArray(courseList) || cancelled) return;
      for (const course of courseList) {
        if (!course || course.id == null) continue;
        router
          .preloadRoute({
            to: "/courses/$courseId",
            params: { courseId: String(course.id) },
          })
          .catch(() => undefined);
      }
    };

    const warm = async () => {
      if (cancelled) return;

      // Check if courses are already in client cache from a previous fetch
      const cachedCourses = queryClient.getQueryData<CourseSummary[]>(["canvas", "courses"]);
      if (cachedCourses) {
        preloadCoursePages(cachedCourses);
      }

      // Stage 1: Parallel prefetch of high-priority routes and core Canvas datasets
      const [coursesResult] = await Promise.allSettled([
        queryClient
          .fetchQuery<CourseSummary[]>({
            queryKey: ["canvas", "courses"],
            queryFn: () => getCoursesFn(),
            staleTime: QUERY_STALE_TIME,
          })
          .catch(() => undefined),
        queryClient
          .prefetchQuery({
            queryKey: ["canvas", "assignments"],
            queryFn: () => getAllAssignmentsFn(),
            staleTime: QUERY_STALE_TIME,
          })
          .catch(() => undefined),
        queryClient
          .prefetchQuery({
            queryKey: ["canvas", "calendar"],
            queryFn: () => getCalendarEventsFn(),
            staleTime: QUERY_STALE_TIME,
          })
          .catch(() => undefined),
        ...PRIMARY_ROUTES.map((to) => router.preloadRoute({ to }).catch(() => undefined)),
      ]);

      if (cancelled) return;

      // Stage 2: Warm dynamic /courses/$courseId routes for each enrolled class
      if (coursesResult?.status === "fulfilled" && Array.isArray(coursesResult.value)) {
        preloadCoursePages(coursesResult.value);
      }

      // Stage 3: Warm secondary routes, announcements, and user account queries
      await Promise.allSettled([
        queryClient
          .prefetchQuery({
            queryKey: ["canvas", "announcements"],
            queryFn: () => getAnnouncementsFn(),
            staleTime: QUERY_STALE_TIME,
          })
          .catch(() => undefined),
        queryClient
          .prefetchQuery({
            queryKey: ["user-profile"],
            queryFn: () => fetchUserProfile(),
            staleTime: USER_DATA_STALE_TIME,
          })
          .catch(() => undefined),
        queryClient
          .prefetchQuery({
            queryKey: ["class-schedule-entries"],
            queryFn: () => fetchClassSchedule(),
            staleTime: USER_DATA_STALE_TIME,
          })
          .catch(() => undefined),
        ...SECONDARY_ROUTES.map((to) => router.preloadRoute({ to }).catch(() => undefined)),
      ]);
    };

    // Schedule preloading when main thread is idle (fallback to 120ms timeout)
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = (
        window as unknown as {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback(warm, { timeout: 1000 });
    } else {
      timerId = setTimeout(warm, 120);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      }
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    };
  }, [enabled, router, queryClient]);
}
