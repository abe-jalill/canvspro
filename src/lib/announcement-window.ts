import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import {
  ANNOUNCEMENT_WINDOW_DEFAULT,
  type AnnouncementWindowWeeks,
} from "./announcement-window-policy";

export const ANNOUNCEMENT_WINDOW_KEY = "announcement_window_weeks";
export {
  ANNOUNCEMENT_WINDOW_DEFAULT,
  withinAnnouncementWindow,
} from "./announcement-window-policy";
export type { AnnouncementWindowWeeks } from "./announcement-window-policy";

/** How far back the announcements list reaches, in weeks (saved to the account). */
export function useAnnouncementWindow() {
  const pref = useUserPreferenceKey<number>(
    ANNOUNCEMENT_WINDOW_KEY,
    ANNOUNCEMENT_WINDOW_DEFAULT,
  );
  const weeks: AnnouncementWindowWeeks =
    pref.value === 0 || pref.value === 2 || pref.value === 4 ? pref.value : 1;
  const label = weeks === 0
    ? "All announcements"
    : weeks === 1
      ? "Last week"
      : weeks === 2
        ? "Last 2 weeks"
        : "Last month";
  return {
    weeks,
    label,
    isLoading: pref.isLoading,
    ready: pref.ready,
    set: (next: AnnouncementWindowWeeks) => pref.set(next),
  };
}
