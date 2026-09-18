import { useEffect } from "react";
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
 * the shared Canvas queries, user settings, and dynamic course detail pages
 * each page reads, so navigation feels completely instantaneous.
 */
export function useAppPrefetch(enabled = true) {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const preloadCoursePages = (courseList: CourseSummary[]) => {
      if (!Array.isArray(courseList)) return;
      for (const c of courseList) {
        router
          .preloadRoute({
            to: "/courses/$courseId",
            params: { courseId: String(c.id) },
          })
          .catch(() => undefined);
      }
    };

    const warm = async () => {
      // If courses are already cached in client memory, preload their pages immediately
      const cachedCourses = queryClient.getQueryData<CourseSummary[]>(["canvas", "courses"]);
      if (cachedCourses) {
        preloadCoursePages(cachedCourses);
      }

      // Route chunks and shared data warm in parallel — nothing waits in line.
      const results = await Promise.allSettled([
        ...ROUTES.map((to) => router.preloadRoute({ to }).catch(() => undefined)),
        queryClient.fetchQuery<CourseSummary[]>({
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
        queryClient.prefetchQuery({
          queryKey: ["user-profile"],
          queryFn: () => fetchUserProfile(),
          staleTime: 60_000,
        }),
        queryClient.prefetchQuery({
          queryKey: ["class-schedule-entries"],
          queryFn: () => fetchClassSchedule(),
          staleTime: 60_000,
        }),
      ]);

      if (cancelled) return;

      // Warm dynamic /courses/$courseId routes for each enrolled class once courses return
      const coursesResult = results[ROUTES.length];
      if (coursesResult?.status === "fulfilled" && Array.isArray(coursesResult.value)) {
        preloadCoursePages(coursesResult.value);
      }
    };

    const idle = setTimeout(warm, 0);
    return () => {
      cancelled = true;
      clearTimeout(idle);
    };
  }, [enabled, router, queryClient]);
}
