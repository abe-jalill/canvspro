import { queryOptions } from "@tanstack/react-query";
import {
  getAllAssignmentsFn,
  getAnnouncementsFn,
  getCalendarEventsFn,
  getClassMeetingsFn,
  getCoursesFn,
} from "@/lib/canvas.functions";

const STALE = 5 * 60_000;

export const coursesQO = queryOptions({
  queryKey: ["canvas", "courses"],
  queryFn: () => getCoursesFn(),
  staleTime: STALE,
});

export const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
  staleTime: STALE,
});

export const announcementsQO = queryOptions({
  queryKey: ["canvas", "announcements"],
  queryFn: () => getAnnouncementsFn(),
  staleTime: STALE,
});

export const eventsQO = queryOptions({
  queryKey: ["canvas", "calendar"],
  queryFn: () => getCalendarEventsFn(),
  staleTime: STALE,
});

export function prefetchAllCanvas(qc: {
  prefetchQuery: (options: never) => Promise<void>;
}) {
  const client = qc as unknown as {
    prefetchQuery: (o: unknown) => Promise<void>;
  };
  void client.prefetchQuery(coursesQO);
  void client.prefetchQuery(assignmentsQO);
  void client.prefetchQuery(announcementsQO);
  void client.prefetchQuery(eventsQO);
}
