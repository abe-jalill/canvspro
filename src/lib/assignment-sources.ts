import type { AssignmentItem } from "./canvas.functions.ts";
import type { CustomAssignment } from "./custom-assignments.ts";

export function customToAssignmentItem(
  custom: CustomAssignment,
  course: { name: string; course_code: string } | undefined,
): AssignmentItem {
  return {
    id: custom.id, name: custom.name, due_at: custom.due_at, html_url: "",
    description: custom.notes, points_possible: custom.points_possible,
    estimated_minutes: custom.estimated_minutes,
    course_id: custom.course_id, course_name: course?.name ?? "", course_code: course?.course_code ?? "",
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
