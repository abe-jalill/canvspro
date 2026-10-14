/**
 * Canvas "Available from" dates. An assignment whose unlock date is still ahead
 * can't be opened yet: the dashboard leaves it out, and other pages say when it
 * opens. A missing date (older cached data, custom work) counts as open.
 */
export function notYetOpen(
  assignment: { unlock_at?: string | null },
  now: number = Date.now(),
): boolean {
  const opensAt = assignment.unlock_at ? Date.parse(assignment.unlock_at) : Number.NaN;
  return Number.isFinite(opensAt) && opensAt > now;
}

/**
 * "Opens today at 9:00 AM", "Opens tomorrow at 9:00 AM" or
 * "Opens Tue, Oct 20 at 9:00 AM", in the student's own time zone.
 */
export function opensLabel(unlockAt: string, now: Date = new Date(), timeZone?: string): string {
  const at = new Date(unlockAt);
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
  const day = dayKey(at);
  if (day === dayKey(now)) return `Opens today at ${time}`;
  if (day === dayKey(new Date(now.getTime() + 86_400_000))) return `Opens tomorrow at ${time}`;
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(at);
  return `Opens ${date} at ${time}`;
}
