/**
 * A class that's still listed but whose Canvas assignments all came back
 * empty, when it had three or more before, keeps them. The server drops a
 * class whose own request failed without saying so, and a real class never
 * loses all its work at once. The iPhone app does the same.
 */
export function keepDroppedClasses<T extends { id: number; course_id: number }>(
  fresh: T[],
  previous: T[] | undefined,
  listedCourseIds: readonly number[],
): T[] {
  if (!previous?.length) return fresh;
  // Canvas assignments only (planner items and your own have negative ids).
  const present = new Set(fresh.filter((item) => item.id > 0).map((item) => item.course_id));
  const listed = new Set(listedCourseIds);
  const before = new Map<number, T[]>();
  for (const item of previous) {
    if (item.id <= 0) continue;
    const list = before.get(item.course_id) ?? [];
    list.push(item);
    before.set(item.course_id, list);
  }
  const kept = [...fresh];
  for (const [courseId, items] of before) {
    if (items.length >= 3 && listed.has(courseId) && !present.has(courseId)) kept.push(...items);
  }
  return kept;
}
