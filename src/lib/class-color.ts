/** Cool, calm hues for classes: never yellow, never near the catch-up rose. */
export const CLASS_HUES = [205, 150, 268, 182, 232, 290, 125];

/** A steady hue per class, by its place in Canvas's list (the iPhone app's too). */
export function classHue(courseId: number, courseIds: readonly number[]) {
  const index = courseIds.indexOf(courseId);
  return CLASS_HUES[(index >= 0 ? index : Math.abs(courseId)) % CLASS_HUES.length];
}

/** The class's color for small accents; lighter in dark mode (see --class-lightness). */
export function classColor(courseId: number, courseIds: readonly number[]) {
  // Your own tasks that aren't for a class (id 0) are a quiet gray, never a class's hue.
  if (courseId === 0) return "hsl(220 8% var(--class-lightness, 68%))";
  return `hsl(${classHue(courseId, courseIds)} 50% var(--class-lightness, 68%))`;
}
