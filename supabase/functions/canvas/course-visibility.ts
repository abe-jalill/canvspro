/**
 * The /courses request already uses enrollment_state=active. Canvas documents
 * that filter as respecting course, section, and term date overrides, so page
 * data must not apply a second, stricter interpretation of "active" here.
 *
 * Only the student's explicit hidden-course preference is a global exclusion.
 * Date windows (one week, two weeks, three weeks, etc.) belong to individual
 * pages and are applied after this canonical Canvas feed reaches the client.
 */
export function isCanvasCourseVisible(
  course: { id: number },
  excludedCourseIds: ReadonlySet<number>,
): boolean {
  return !excludedCourseIds.has(course.id);
}
