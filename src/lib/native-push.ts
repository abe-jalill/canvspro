// iPhone push, sent through Apple's push service by supabase/functions/apns.
// The iPhone app schedules due-date, class, "due tonight" and streak reminders
// on the phone itself, so the server only sends what the phone can't know on
// its own: new grades and new announcements. Sending the rest would buzz twice.

/** Whether an alert (by id) also goes to the student's iPhones. */
export function nativeAlertAllowed(id: string): boolean {
  return id.startsWith("grade:") || id.startsWith("announcement:");
}

/** The alert ids the apns function says reached at least one iPhone. */
export function nativeDelivered(answer: unknown, sent: string[]): Set<string> {
  const delivered =
    answer &&
    typeof answer === "object" &&
    Array.isArray((answer as { delivered?: unknown }).delivered)
      ? (answer as { delivered: unknown[] }).delivered
      : [];
  const asked = new Set(sent);
  return new Set(delivered.filter((id): id is string => typeof id === "string" && asked.has(id)));
}
