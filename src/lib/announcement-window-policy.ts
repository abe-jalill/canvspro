export const ANNOUNCEMENT_WINDOW_DEFAULT = 1;

/** Zero means no age limit ("All"). */
export type AnnouncementWindowWeeks = 0 | 1 | 2 | 4;

/** True when a posted date falls inside the chosen window. */
export function withinAnnouncementWindow(
  postedAt: string | null,
  weeks: number,
  now = Date.now(),
): boolean {
  if (weeks === 0) return true;
  if (!postedAt) return true;
  const t = new Date(postedAt).getTime();
  if (Number.isNaN(t)) return true;
  return t >= now - weeks * 7 * 24 * 60 * 60 * 1000;
}
