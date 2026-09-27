import { queryOptions, type QueryClient } from "@tanstack/react-query";
import {
  getCoursesFn,
  getAllAssignmentsFn,
  getCalendarEventsFn,
  getAnnouncementsFn,
  getDueDatesFn,
} from "./canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "./query-policy";

/**
 * Shared query options for Canvas data.
 * All views (Dashboard, Grades, Assignments, Calendar, Sidebar, Focus) share
 * these query options to guarantee stale-while-revalidate behavior:
 * - Fresh data (< 15 mins) renders instantly from memory.
 * - Stale data restored from persistence renders immediately, while TanStack Query
 *   silently revalidates in the background so returning users never see a blank screen.
 */

export const coursesQueryOptions = queryOptions({
  queryKey: ["canvas", "courses"] as const,
  queryFn: () => getCoursesFn(),
  staleTime: CANVAS_DATA_STALE_MS,
  gcTime: CANVAS_DATA_GC_MS,
  refetchOnMount: true,
});

export const assignmentsQueryOptions = queryOptions({
  queryKey: ["canvas", "assignments"] as const,
  queryFn: () => getAllAssignmentsFn(),
  staleTime: CANVAS_DATA_STALE_MS,
  gcTime: CANVAS_DATA_GC_MS,
  refetchOnMount: true,
});

export const calendarQueryOptions = queryOptions({
  queryKey: ["canvas", "calendar"] as const,
  queryFn: () => getCalendarEventsFn(),
  staleTime: CANVAS_DATA_STALE_MS,
  gcTime: CANVAS_DATA_GC_MS,
  refetchOnMount: true,
});

export const announcementsQueryOptions = queryOptions({
  queryKey: ["canvas", "announcements"] as const,
  queryFn: () => getAnnouncementsFn(),
  staleTime: CANVAS_DATA_STALE_MS,
  gcTime: CANVAS_DATA_GC_MS,
  refetchOnMount: true,
});

export const dueDatesQueryOptions = queryOptions({
  queryKey: ["canvas", "assignments"] as const,
  queryFn: () => getAllAssignmentsFn(),
  staleTime: CANVAS_DATA_STALE_MS,
  gcTime: CANVAS_DATA_GC_MS,
  refetchOnMount: true,
});

/**
 * Optimistic prefetch triggers for navigation.
 * Called when hovering or focusing navigation links to warm the query cache
 * before the user finishes clicking.
 */
export function prefetchRouteQueries(client: QueryClient, to: string) {
  switch (to) {
    case "/grades":
      void client.prefetchQuery(coursesQueryOptions);
      void client.prefetchQuery(assignmentsQueryOptions);
      break;
    case "/assignments":
    case "/focus":
    case "/get-it-done":
    case "/study-session":
      void client.prefetchQuery(assignmentsQueryOptions);
      void client.prefetchQuery(coursesQueryOptions);
      break;
    case "/schedule":
      void client.prefetchQuery(calendarQueryOptions);
      void client.prefetchQuery(assignmentsQueryOptions);
      break;
    case "/announcements":
      void client.prefetchQuery(announcementsQueryOptions);
      break;
    case "/dashboard":
      void client.prefetchQuery(coursesQueryOptions);
      void client.prefetchQuery(assignmentsQueryOptions);
      void client.prefetchQuery(calendarQueryOptions);
      break;
    default:
      if (to.startsWith("/courses/")) {
        void client.prefetchQuery(coursesQueryOptions);
        void client.prefetchQuery(assignmentsQueryOptions);
      }
      break;
  }
}
