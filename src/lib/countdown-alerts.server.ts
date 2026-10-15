// Builds the time-scheduled "countdown" pushes: next class starting in X minutes,
// tonight's 11:59 PM deadline summary and the 6 PM streak reminder. Rows are
// queued ahead of time so a 5-minute warning lands on the minute even though the
// cron only runs every 15.

import { STREAK_REMINDER_HOUR, streakReminder } from "./streak.ts";

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

/**
 * When work is due, the way a person says it: "today at 7:30 PM", "tomorrow at
 * 9:00 AM", or "10/17 at 11:59 PM". In the student's own time zone, with no
 * seconds, no leading zero and no year.
 */
export function dueLabel(due: Date, now: Date, tzOffsetMinutes: number): string {
  const local = localMs(due, tzOffsetMinutes);
  const day = Math.floor(local / DAY_MS);
  const today = Math.floor(localMs(now, tzOffsetMinutes) / DAY_MS);
  const wall = new Date(local);
  const time = timeLabel(wall.getUTCHours() * 60 + wall.getUTCMinutes());
  if (day === today) return `today at ${time}`;
  if (day === today + 1) return `tomorrow at ${time}`;
  return `${wall.getUTCMonth() + 1}/${wall.getUTCDate()} at ${time}`;
}

function leadLabel(minutes: number): string {
  if (minutes <= 0) return "starts now";
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `starts in ${h} hour${h === 1 ? "" : "s"}`;
  }
  return `starts in ${minutes} min`;
}

const CLASS_TAG = /^class:(\d{4}-\d{2}-\d{2}):(\d+):(.*):(\d+)$/s;
// Tonight's deadlines and the streak reminder both stop being useful at 11:59 PM.
const TONIGHT_TAG = /^(tonight|streak):(\d{4}-\d{2}-\d{2}):(\d+)$/;

/**
 * Which queued countdowns to send now and which are no longer worth sending.
 * A 5-minute run can be missed (a deploy, a hiccup), so a late reminder still
 * goes out while it is useful: within `graceMs` exactly as queued, after that
 * with its countdown recalculated ("starts in 7 min"). It is dropped once the
 * class has started or tonight's 11:59 PM deadline has passed. When several
 * steps for the same class or night are due, only the latest goes out.
 */
export function planScheduledAlerts<T extends { tag: string; fire_at: string; title: string }>(
  rows: T[],
  now: Date,
  graceMs: number,
): { send: T[]; drop: T[] } {
  const nowMs = now.getTime();
  const drop: T[] = [];
  const latest = new Map<string, { row: T; fire: number; endsAt: number; className?: string }>();

  for (const row of rows) {
    const fire = Date.parse(row.fire_at);
    if (!Number.isFinite(fire) || fire > nowMs) continue;
    const cls = CLASS_TAG.exec(row.tag);
    const night = TONIGHT_TAG.exec(row.tag);
    // When the reminder stops being useful: class start, or 11:59 PM that night.
    const endsAt = cls
      ? fire + Number(cls[4]) * 60_000
      : night
        ? fire + (23 * 60 + 59 - Number(night[3]) * 60) * 60_000
        : fire + graceMs;
    if (nowMs - fire > graceMs && nowMs >= endsAt) {
      drop.push(row);
      continue;
    }
    const key = cls
      ? `class:${cls[1]}:${cls[2]}:${cls[3]}`
      : night
        ? `${night[1]}:${night[2]}`
        : row.tag;
    const current = latest.get(key);
    if (current && current.fire >= fire) {
      drop.push(row);
      continue;
    }
    if (current) drop.push(current.row);
    latest.set(key, { row, fire, endsAt, className: cls?.[3] });
  }

  const send = Array.from(latest.values()).map(({ row, fire, endsAt, className }) => {
    if (className === undefined || nowMs - fire <= graceMs) return row;
    return { ...row, title: `${className} ${leadLabel(Math.ceil((endsAt - nowMs) / 60_000))}` };
  });
  return { send, drop };
}

/** The instant 11:59 PM tonight, local to the user. */
export function endOfLocalDay(now: Date, tzOffsetMinutes: number): number {
  return (
    localDayStart(now, tzOffsetMinutes, 0) + 23 * 3_600_000 + 59 * 60_000 + tzOffsetMinutes * 60_000
  );
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

/**
 * "Don't break your streak!!!" at 6 PM local, for a streak that ends at
 * midnight unless the student opens CoursePro today. Queued like tonight's
 * reminder; opening the app marks it handled (record_streak_activity) and the
 * sender checks again before it goes out.
 */
export function buildStreakAlert(
  streak: StreakRow | null,
  prefs: { streakReminder?: boolean },
  tzOffsetMinutes: number,
  now = new Date(),
  horizonMs = 4 * 3_600_000,
): ScheduledAlertRow | null {
  if (!streak || prefs.streakReminder === false) return null;
  const dayStart = localDayStart(now, tzOffsetMinutes, 0);
  const today = dateKey(dayStart);
  const reminder = streakReminder(streak, today);
  if (!reminder) return null;
  const fire = dayStart + STREAK_REMINDER_HOUR * 3_600_000 + tzOffsetMinutes * 60_000;
  const nowMs = now.getTime();
  if (fire < nowMs - 5 * 60_000 || fire > nowMs + horizonMs) return null;
  return {
    tag: `streak:${today}:${STREAK_REMINDER_HOUR}`,
    fire_at: new Date(fire).toISOString(),
    title: reminder.title,
    body: reminder.body,
    to_path: "/dashboard",
    badge: null,
  };
}

/** The student's own date, `YYYY-MM-DD`, from their saved time zone offset. */
export function localDateFor(now: Date, tzOffsetMinutes: number): string {
  return dateKey(localDayStart(now, tzOffsetMinutes, 0));
}

export interface StreakRow {
  current_streak: number;
  last_active_on: string | null;
  freeze_used_on: string | null;
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
