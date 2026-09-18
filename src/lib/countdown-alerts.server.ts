// Builds the time-scheduled "countdown" pushes: next class starting in X minutes
// and tonight's 11:59 PM deadline summary. Rows are queued ahead of time so a
// 5-minute warning lands on the minute even though the cron only runs every 15.

export interface ScheduleRow {
  title: string;
  days: string[] | null;
  start_minutes: number;
  end_minutes: number;
  location: string | null;
}

export interface ScheduledAlertRow {
  tag: string;
  fire_at: string;
  title: string;
  body: string;
  to_path: string;
  badge: number | null;
}

export interface CountdownPrefs {
  countdownClass: boolean;
  countdownLeads: number[];
  countdownTonight: boolean;
  countdownTonightHours: number[];
  badge: boolean;
}

const DAY_TO_INDEX: Record<string, number> = { M: 1, T: 2, W: 3, R: 4, F: 5 };
const DAY_MS = 86_400_000;

/** Wall-clock milliseconds in the user's local zone, expressed as a UTC instant. */
function localMs(now: Date, tzOffsetMinutes: number): number {
  return now.getTime() - tzOffsetMinutes * 60_000;
}

function localDayStart(now: Date, tzOffsetMinutes: number, dayOffset: number): number {
  const l = localMs(now, tzOffsetMinutes);
  return Math.floor(l / DAY_MS) * DAY_MS + dayOffset * DAY_MS;
}

function dateKey(localDayStartMs: number): string {
  return new Date(localDayStartMs).toISOString().slice(0, 10);
}

function timeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function leadLabel(minutes: number): string {
  if (minutes <= 0) return "starts now";
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `starts in ${h} hour${h === 1 ? "" : "s"}`;
  }
  return `starts in ${minutes} min`;
}

/** The instant 11:59 PM tonight, local to the user. */
export function endOfLocalDay(now: Date, tzOffsetMinutes: number): number {
  return localDayStart(now, tzOffsetMinutes, 0) + 23 * 3_600_000 + 59 * 60_000 + tzOffsetMinutes * 60_000;
}

/**
 * Class countdown rows for the next `horizonMs` of wall-clock time.
 * One row per (class occurrence, lead time) so a push replaces the previous
 * step rather than stacking: the tag stays constant per occurrence.
 */
export function buildClassCountdownAlerts(
  entries: ScheduleRow[],
  prefs: CountdownPrefs,
  tzOffsetMinutes: number,
  now = new Date(),
  horizonMs = 4 * 3_600_000,
): ScheduledAlertRow[] {
  if (!prefs.countdownClass || entries.length === 0) return [];
  const leads = Array.from(new Set(prefs.countdownLeads.filter((n) => n >= 0))).sort(
    (a, b) => b - a,
  );
  if (leads.length === 0) return [];

  const rows: ScheduledAlertRow[] = [];
  const nowMs = now.getTime();

  for (const dayOffset of [0, 1]) {
    const dayStart = localDayStart(now, tzOffsetMinutes, dayOffset);
    const weekday = new Date(dayStart).getUTCDay();
    const key = dateKey(dayStart);

    for (const entry of entries) {
      const days = entry.days ?? [];
      if (!days.some((d) => DAY_TO_INDEX[d] === weekday)) continue;
      const startInstant = dayStart + entry.start_minutes * 60_000 + tzOffsetMinutes * 60_000;

      for (const lead of leads) {
        const fire = startInstant - lead * 60_000;
        if (fire < nowMs - 5 * 60_000) continue;
        if (fire > nowMs + horizonMs) continue;
        const where = entry.location?.trim();
        rows.push({
          tag: `class:${key}:${entry.start_minutes}:${entry.title}:${lead}`,
          fire_at: new Date(fire).toISOString(),
          title: `${entry.title} ${leadLabel(lead)}`,
          body: [timeLabel(entry.start_minutes), where].filter(Boolean).join(" · "),
          to_path: "/class-schedule",
          badge: null,
        });
      }
    }
  }
  return rows;
}

export interface TonightItem {
  name: string;
  courseName: string;
}

/** Evening reminder(s) summarising everything due before 11:59 PM today. */
export function buildTonightAlerts(
  items: TonightItem[],
  prefs: CountdownPrefs,
  tzOffsetMinutes: number,
  now = new Date(),
  horizonMs = 4 * 3_600_000,
): ScheduledAlertRow[] {
  if (!prefs.countdownTonight || items.length === 0) return [];
  const hours = Array.from(new Set(prefs.countdownTonightHours)).sort((a, b) => a - b);
  if (hours.length === 0) return [];

  const dayStart = localDayStart(now, tzOffsetMinutes, 0);
  const key = dateKey(dayStart);
  const nowMs = now.getTime();
  const rows: ScheduledAlertRow[] = [];

  for (const hour of hours) {
    const fire = dayStart + hour * 3_600_000 + tzOffsetMinutes * 60_000;
    if (fire < nowMs - 5 * 60_000) continue;
    if (fire > nowMs + horizonMs) continue;
    const count = items.length;
    rows.push({
      tag: `tonight:${key}:${hour}`,
      fire_at: new Date(fire).toISOString(),
      title:
        count === 1
          ? `Due tonight by 11:59 PM: ${items[0]!.name}`
          : `${count} assignments due tonight by 11:59 PM`,
      body: items
        .slice(0, 3)
        .map((i) => `${i.name} · ${i.courseName}`)
        .join("\n"),
      to_path: "/assignments",
      badge: count,
    });
  }
  return rows;
}
