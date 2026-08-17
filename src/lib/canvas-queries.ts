import { queryOptions } from "@tanstack/react-query";
import {
  getAllAssignmentsFn,
  getAnnouncementsFn,
  getCalendarEventsFn,
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
  queryKey: ["canvas", "events"],
  queryFn: () => getCalendarEventsFn(),
  staleTime: STALE,
});

export const allCanvasQueries = [
  coursesQO,
  assignmentsQO,
  announcementsQO,
  eventsQO,
];
