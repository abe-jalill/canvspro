import { useSyncedSet } from "@/lib/synced-state";

export const DISMISSED_ANNOUNCEMENTS_KEY = "dismissed-announcements";
export const COMPLETED_ASSIGNMENTS_KEY = "completed-assignments";

/** Cross-device persisted Set<string> backed by user_preferences.
 * Kept the old name for backwards compatibility with existing imports.
 */
export function useLocalSet(baseKey: string) {
  return useSyncedSet(baseKey);
}
