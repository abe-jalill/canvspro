import type { AssignmentItem } from "./canvas.functions.ts";
import type { CustomAssignment } from "./custom-assignments.ts";

/** The class id of your own task that isn't for a class (the iPhone app uses 0 too). */
export const NO_CLASS_ID = 0;
/** What a task that isn't for a class shows where a class name would be. */
export const NO_CLASS_LABEL = "Personal";

/** Personal tasks belong only to the hero, To-Do widget and To-Do page. */
export function customAssignmentsForSurface<T extends { course_id: number }>(
  items: T[], includePersonalTasks = false,
): T[] {
  return includePersonalTasks ? items : items.filter((item) => item.course_id !== NO_CLASS_ID);
}

export function customToAssignmentItem(
  custom: CustomAssignment,
  course: { name: string; course_code: string } | undefined,
): AssignmentItem {
  const fallback = custom.course_id === NO_CLASS_ID ? NO_CLASS_LABEL : "";
  return {
    id: custom.id, name: custom.name, due_at: custom.due_at, html_url: "",
    description: custom.notes, points_possible: custom.points_possible,
    estimated_minutes: custom.estimated_minutes,
    course_id: custom.course_id, course_name: course?.name ?? fallback, course_code: course?.course_code ?? "",
  };
}

/** Both sources participate in the same dashboard filters and ordering. */
export function mergeAssignments(
  canvas: AssignmentItem[],
  custom: CustomAssignment[],
  courses: { id: number; name: string; course_code: string }[],
): AssignmentItem[] {
  const byId = new Map(courses.map((course) => [course.id, course]));
  return [...canvas, ...custom.map((item) => customToAssignmentItem(item, byId.get(item.course_id)))];
}
