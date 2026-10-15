// Daily streaks: a day counts when the student opens CoursePro that calendar
// day, in their own time zone. The database (record_streak_activity) owns the
// count and the monthly freeze; this module only reads and describes it, for
// the website, the 6 PM reminder and tests alike.

/** What `record_streak_activity(p_today)` returns. Dates are `YYYY-MM-DD`. */
export interface StreakStatus {
  current: number;
  longest: number;
  /** The streak before this call; `extended` says whether today just counted. */
  previous: number;
  extended: boolean;
  /** The missed day a streak freeze covered on this call, if one did. */
  froze: string | null;
  /** The streak that ended on this call (0 when nothing ended). */
  lost: number;
  today: string;
  last_active_on: string | null;
  freeze_used_on: string | null;
  freeze_available: boolean;
  /** Newest first. */
  recent_days: string[];
  frozen_days: string[];
}

export const STREAK_REMINDER_HOUR = 18;
export const STREAK_REMINDER_TITLE = "Don't break your streak!!!";

/** Streak lengths that get their own celebration. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365, 500, 1000];

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The device's own calendar date, `YYYY-MM-DD`. */
export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A `YYYY-MM-DD` date moved by whole days (calendar math, no time zones). */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const moved = new Date(Date.UTC(y!, m! - 1, d! + days));
  return moved.toISOString().slice(0, 10);
}

function weekday(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** The first day of the month after `key`'s, for "a new freeze arrives Nov 1". */
export function nextMonthStart(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 1)).toISOString().slice(0, 10);
}

/** Whether this month's freeze can still cover `missedDay`. */
export function freezeCovers(freezeUsedOn: string | null, missedDay: string): boolean {
  return !freezeUsedOn || freezeUsedOn.slice(0, 7) !== missedDay.slice(0, 7);
}

function dateList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && DATE_KEY.test(v))
    : [];
}

function dateOrNull(value: unknown): string | null {
  return typeof value === "string" && DATE_KEY.test(value) ? value : null;
}

function count(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Reads the RPC's answer; null when it isn't a streak (e.g. not deployed yet). */
export function parseStreakStatus(value: unknown): StreakStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const today = dateOrNull(raw.today);
  if (!today) return null;
  return {
    current: count(raw.current),
    longest: count(raw.longest),
    previous: count(raw.previous),
    extended: raw.extended === true,
    froze: dateOrNull(raw.froze),
    lost: count(raw.lost),
    today,
    last_active_on: dateOrNull(raw.last_active_on),
    freeze_used_on: dateOrNull(raw.freeze_used_on),
    freeze_available: raw.freeze_available !== false,
    recent_days: dateList(raw.recent_days),
    frozen_days: dateList(raw.frozen_days),
  };
}

export type StreakDayState = "active" | "frozen" | "missed" | "pending" | "future";

export interface StreakDay {
  key: string;
  /** "S", "M", "T"… */
  letter: string;
  state: StreakDayState;
  isToday: boolean;
}

/** This week, Sunday to Saturday, the way Duolingo's streak calendar shows it. */
export function streakWeek(status: StreakStatus): StreakDay[] {
  const active = new Set(status.recent_days);
  const frozen = new Set(status.frozen_days);
  const start = addDays(status.today, -weekday(status.today));
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i);
    const isToday = key === status.today;
    const state: StreakDayState = active.has(key)
      ? "active"
      : frozen.has(key)
        ? "frozen"
        : key > status.today
          ? "future"
          : isToday
            ? "pending"
            : "missed";
    return { key, letter: "SMTWTFS"[i]!, state, isToday };
  });
}

/** The next milestone above `current`, or the next hundred past the list. */
export function nextMilestone(current: number): number {
  return STREAK_MILESTONES.find((m) => m > current) ?? (Math.floor(current / 100) + 1) * 100;
}

/** Fills in "{name}" with a first name, or drops it cleanly without one. */
function withName(text: string, name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? text.replace("{name}", first) : text.replace(/,? ?\{name\}/, "");
}

/**
 * The celebration's headline and line when today counts: a freeze that saved
 * the streak, a streak that ended, day 1, a milestone, or one of several
 * everyday lines (picked by the day count, so a reload shows the same one).
 */
export function streakCelebrationCopy(
  status: StreakStatus,
  name?: string | null,
): { title: string; line: string } {
  const n = status.current;
  if (status.froze) {
    const day = WEEKDAY_NAMES[weekday(status.froze)];
    return {
      title: "Streak freeze saved you!",
      line: withName(`Your freeze covered ${day}, {name}. ${n} days and still burning.`, name),
    };
  }
  if (status.lost > 1) {
    return {
      title: "Day 1. Let's go again.",
      line: withName(
        `Your ${status.lost}-day streak ended, but the comeback starts now, {name}. See you tomorrow?`,
        name,
      ),
    };
  }
  if (n <= 1) {
    return {
      title: "Streak started!",
      line: withName("Day 1, {name}! Open CoursePro tomorrow to make it 2.", name),
    };
  }
  if (STREAK_MILESTONES.includes(n)) {
    const special: Record<number, string> = {
      3: "Three days in a row, {name}. A habit is forming.",
      7: "A full week, {name}! You're officially on a roll.",
      14: "Two weeks straight, {name}. Unstoppable.",
      30: "A whole month, {name}. That's legendary.",
      100: "One hundred days, {name}. Hall of fame.",
      365: "A full year, {name}. Absolutely iconic.",
    };
    return {
      title: `${n}-day milestone!`,
      line: withName(special[n] ?? `${n} days in a row, {name}. That's real dedication.`, name),
    };
  }
  const next = nextMilestone(n);
  const lines = [
    `On fire, {name}! Come back tomorrow for day ${n + 1}.`,
    `${next - n} more ${next - n === 1 ? "day" : "days"} to your ${next}-day milestone, {name}.`,
    `Look at you go, {name}. Day ${n + 1} is waiting tomorrow.`,
    `Your future self says thanks, {name}. Keep it burning.`,
  ];
  return { title: `${n} day streak!`, line: withName(lines[n % lines.length]!, name) };
}

/**
 * The 6 PM reminder for a streak that ends at midnight unless the student
 * opens CoursePro, or null when there's nothing to save. `today` is the
 * student's own date. A streak that missed yesterday can still be saved when
 * this month's freeze is unused; the database applies the freeze when they
 * come back.
 */
export function streakReminder(
  streak: { current_streak: number; last_active_on: string | null; freeze_used_on: string | null },
  today: string,
): { title: string; body: string } | null {
  const n = streak.current_streak;
  const last = streak.last_active_on;
  if (n <= 0 || !last || last >= today) return null;
  const yesterday = addDays(today, -1);
  if (last === yesterday) {
    return {
      title: STREAK_REMINDER_TITLE,
      body:
        n === 1
          ? "Make it 2 days in a row 🔥 Open CoursePro before midnight."
          : `Your ${n}-day streak ends at midnight 🔥 Open CoursePro to keep it alive.`,
    };
  }
  if (last === addDays(today, -2) && freezeCovers(streak.freeze_used_on, yesterday)) {
    return {
      title: STREAK_REMINDER_TITLE,
      body: `Your streak freeze is holding your ${n}-day streak 🧊 Open CoursePro before midnight to keep it.`,
    };
  }
  return null;
}
