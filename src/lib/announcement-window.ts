import { useUserPreferenceKey } from "@/hooks/use-user-preferences";

export const ANNOUNCEMENT_WINDOW_KEY = "announcement_window_weeks";
export const ANNOUNCEMENT_WINDOW_DEFAULT = 2;

export type AnnouncementWindowWeeks = 1 | 2;

/** How far back the announcements list reaches, in weeks (saved to the account). */
export function useAnnouncementWindow() {
  const pref = useUserPreferenceKey<number>(
    ANNOUNCEMENT_WINDOW_KEY,
    ANNOUNCEMENT_WINDOW_DEFAULT,
  );
  const weeks: AnnouncementWindowWeeks = pref.value === 1 ? 1 : 2;
  return {
    weeks,
    label: weeks === 1 ? "Last week" : "Last 2 weeks",
    isLoading: pref.isLoading,
    ready: pref.ready,
    set: (next: AnnouncementWindowWeeks) => pref.set(next),
  };
}

/** True when a posted date falls inside the chosen window. */
export function withinAnnouncementWindow(
  postedAt: string | null,
  weeks: number,
  now = Date.now(),
): boolean {
  if (!postedAt) return true;
  const t = new Date(postedAt).getTime();
  if (Number.isNaN(t)) return true;
  return t >= now - weeks * 7 * 24 * 60 * 60 * 1000;
}
