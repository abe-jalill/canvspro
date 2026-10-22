import { useCallback, useMemo } from "react";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { CALENDAR_EVENTS_KEY, readEvents, type CalendarEvent } from "@/lib/calendar-events";

/** Your events on the Calendar, saved to the account (the iPhone app's too). */
export function useCalendarEvents() {
  const { value, set, isLoading, ready } = useUserPreferenceKey<unknown>(CALENDAR_EVENTS_KEY, []);
  const list = useMemo(() => readEvents(value), [value]);
  const add = useCallback(
    (event: Omit<CalendarEvent, "id">) => {
      const id = `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      set([...list, { ...event, id }]);
    },
    [list, set],
  );
  const update = useCallback(
    (event: CalendarEvent) => set(list.map((item) => (item.id === event.id ? event : item))),
    [list, set],
  );
  const remove = useCallback(
    (id: string) => set(list.filter((item) => item.id !== id)),
    [list, set],
  );
  return { list, add, update, remove, isLoading, ready };
}
