import { createServerFn } from "@tanstack/react-start";

export const getCoursesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { fetchActiveCourses } = await import("./canvas.server");
    const courses = await fetchActiveCourses();
    return courses.map((c) => {
      const enr = c.enrollments?.find((e) => e.type === "student") ?? c.enrollments?.[0];
      return {
        id: c.id,
        name: c.name,
        course_code: c.course_code,
        current_score: enr?.computed_current_score ?? null,
        current_grade: enr?.computed_current_grade ?? null,
        final_score: enr?.computed_final_score ?? null,
      };
    });
  },
);

export const getAllAssignmentsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { fetchAllAssignments } = await import("./canvas.server");
    return fetchAllAssignments();
  },
);

export const getAnnouncementsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { fetchAnnouncements } = await import("./canvas.server");
    return fetchAnnouncements(30);
  },
);

export const getCalendarEventsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { fetchCalendarEvents } = await import("./canvas.server");
    return fetchCalendarEvents(14);
  },
);
