import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addDays,
  freezeCovers,
  localDateKey,
  nextMilestone,
  nextMonthStart,
  parseStreakStatus,
  streakCelebrationCopy,
  streakReminder,
  streakWeek,
  STREAK_REMINDER_TITLE,
} from "../src/lib/streak.ts";
import { buildStreakAlert, planScheduledAlerts } from "../src/lib/countdown-alerts.server.ts";

const status = (over = {}) => ({
  current: 12,
  longest: 21,
  previous: 11,
  extended: true,
  froze: null,
  lost: 0,
  today: "2026-10-14",
  last_active_on: "2026-10-14",
  freeze_used_on: null,
  freeze_available: true,
  recent_days: ["2026-10-14", "2026-10-13", "2026-10-12"],
  frozen_days: [],
  ...over,
});

test("dates are calendar dates: local key, day math across months, next month", () => {
  assert.equal(localDateKey(new Date(2026, 9, 4, 23, 30)), "2026-10-04");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(nextMonthStart("2026-12-09"), "2027-01-01");
});

test("the server's answer is read defensively; anything else is no streak", () => {
  assert.equal(parseStreakStatus(null), null);
  assert.equal(parseStreakStatus({ current: 3 }), null);
  const parsed = parseStreakStatus({
    current: "4",
    today: "2026-10-14",
    recent_days: ["2026-10-14", "nope", 5],
    extended: "yes",
  });
  assert.equal(parsed.current, 4);
  assert.equal(parsed.extended, false);
  assert.deepEqual(parsed.recent_days, ["2026-10-14"]);
  assert.equal(parsed.freeze_available, true);
});

test("the week strip runs Sunday to Saturday with active, frozen, missed and future days", () => {
  // Wednesday Oct 14 2026.
  const week = streakWeek(
    status({
      recent_days: ["2026-10-14", "2026-10-12", "2026-10-11"],
      frozen_days: ["2026-10-13"],
    }),
  );
  assert.deepEqual(
    week.map((d) => d.letter),
    ["S", "M", "T", "W", "T", "F", "S"],
  );
  assert.deepEqual(
    week.map((d) => d.state),
    ["active", "active", "frozen", "active", "future", "future", "future"],
  );
  assert.equal(week.find((d) => d.isToday).key, "2026-10-14");
  const fresh = streakWeek(status({ recent_days: [], today: "2026-10-14" }));
  assert.equal(fresh[3].state, "pending");
  assert.equal(fresh[0].state, "missed");
});

test("one freeze per calendar month", () => {
  assert.equal(freezeCovers(null, "2026-10-13"), true);
  assert.equal(freezeCovers("2026-10-02", "2026-10-13"), false);
  assert.equal(freezeCovers("2026-09-30", "2026-10-13"), true);
});

test("the 6 PM reminder only goes out when there's a streak to save", () => {
  const today = "2026-10-14";
  const alive = streakReminder(
    { current_streak: 12, last_active_on: "2026-10-13", freeze_used_on: null },
    today,
  );
  assert.equal(alive.title, "Don't break your streak!!!");
  assert.equal(STREAK_REMINDER_TITLE, "Don't break your streak!!!");
  assert.match(alive.body, /12-day streak ends at midnight/);
  assert.match(
    streakReminder({ current_streak: 1, last_active_on: "2026-10-13", freeze_used_on: null }, today)
      .body,
    /Make it 2 days in a row/,
  );
  // Already opened today, no streak, or nothing left to save.
  for (const streak of [
    { current_streak: 12, last_active_on: today, freeze_used_on: null },
    { current_streak: 0, last_active_on: "2026-10-13", freeze_used_on: null },
    { current_streak: 5, last_active_on: "2026-10-10", freeze_used_on: null },
    { current_streak: 5, last_active_on: "2026-10-12", freeze_used_on: "2026-10-01" },
  ]) {
    assert.equal(streakReminder(streak, today), null, JSON.stringify(streak));
  }
  // Missed yesterday, but this month's freeze can still cover it.
  const frozen = streakReminder(
    { current_streak: 5, last_active_on: "2026-10-12", freeze_used_on: "2026-09-20" },
    today,
  );
  assert.match(frozen.body, /streak freeze is holding your 5-day streak/);
});

test("the reminder is queued for 6 PM in the student's own time zone", () => {
  const streak = { current_streak: 12, last_active_on: "2026-10-13", freeze_used_on: null };
  // US Eastern (UTC-4 → offset 240), 3:00 PM local.
  const now = new Date("2026-10-14T19:00:00Z");
  const row = buildStreakAlert(streak, { streakReminder: true }, 240, now);
  assert.equal(row.tag, "streak:2026-10-14:18");
  assert.equal(row.fire_at, "2026-10-14T22:00:00.000Z");
  assert.equal(row.title, "Don't break your streak!!!");
  assert.equal(row.to_path, "/dashboard");
  // Too early to queue, turned off, already past, or no streak row.
  assert.equal(buildStreakAlert(streak, {}, 240, new Date("2026-10-14T13:00:00Z")), null);
  assert.equal(buildStreakAlert(streak, { streakReminder: false }, 240, now), null);
  assert.equal(buildStreakAlert(streak, {}, 240, new Date("2026-10-14T23:00:00Z")), null);
  assert.equal(buildStreakAlert(null, {}, 240, now), null);
});

test("a late streak reminder still goes out before midnight, never after", () => {
  const row = {
    tag: "streak:2026-10-14:18",
    fire_at: "2026-10-14T22:00:00.000Z",
    title: "Don't break your streak!!!",
  };
  // 9 PM local: a missed run's reminder is still useful.
  const late = planScheduledAlerts([row], new Date("2026-10-15T01:00:00Z"), 6 * 60_000);
  assert.equal(late.send.length, 1);
  // After 11:59 PM local the day is over.
  const over = planScheduledAlerts([row], new Date("2026-10-15T04:10:00Z"), 6 * 60_000);
  assert.equal(over.send.length, 0);
  assert.equal(over.drop.length, 1);
  // Tonight's reminder for the same night is a separate notification.
  const both = planScheduledAlerts(
    [row, { ...row, tag: "tonight:2026-10-14:18", title: "Due tonight" }],
    new Date("2026-10-14T22:01:00Z"),
    6 * 60_000,
  );
  assert.equal(both.send.length, 2);
});

test("the streak reminder is on by default and follows its own toggle", () => {
  const server = readFileSync(
    new URL("../src/lib/push-dispatch.server.ts", import.meta.url),
    "utf8",
  );
  const client = readFileSync(new URL("../src/lib/notification-prefs.ts", import.meta.url), "utf8");
  assert.match(server, /badge: false,\s+streakReminder: true,\s+\};/);
  assert.match(client, /badge: false,\s+streakReminder: true,\s+\};/);
  // Its own toggle, checked before tonight's fallback.
  assert.match(
    server,
    /if \(tag\.startsWith\("streak:"\)\) return prefs\.streakReminder !== false;\s+if \(tag\.startsWith\("class:"\)\)/,
  );
});

test("celebrations are personal: name, milestones, freezes and comebacks", () => {
  const plain = streakCelebrationCopy(status({ current: 12 }), "Maya Chen");
  assert.equal(plain.title, "12 day streak!");
  assert.match(plain.line, /Maya/);
  assert.doesNotMatch(plain.line, /Chen|\{name\}/);
  assert.equal(streakCelebrationCopy(status({ current: 7 }), "Maya").title, "7-day milestone!");
  assert.match(streakCelebrationCopy(status({ current: 7 }), "Maya").line, /full week, Maya/);
  assert.equal(
    streakCelebrationCopy(status({ current: 1, previous: 0 }), "Maya").title,
    "Streak started!",
  );
  const saved = streakCelebrationCopy(status({ froze: "2026-10-13" }), "Maya");
  assert.equal(saved.title, "Streak freeze saved you!");
  assert.match(saved.line, /Tuesday/);
  const comeback = streakCelebrationCopy(status({ current: 1, lost: 9 }), "Maya");
  assert.match(comeback.line, /9-day streak ended/);
  // Without a name every line still reads naturally.
  for (const n of [1, 2, 3, 4, 5, 7, 12, 30, 41]) {
    const copy = streakCelebrationCopy(status({ current: n }), null);
    assert.doesNotMatch(copy.line, /\{name\}|, \.|,\s*!/, copy.line);
  }
  assert.equal(nextMilestone(12), 14);
  assert.equal(nextMilestone(1000), 1100);
});

test("the database owns the streak: monthly freeze, local dates, reminder cleared on open", () => {
  const sql = readFileSync(
    new URL("../drizzle/migrations/0014_daily_streaks.sql", import.meta.url),
    "utf8",
  );
  const journal = readFileSync(
    new URL("../drizzle/migrations/meta/_journal.json", import.meta.url),
    "utf8",
  );
  assert.match(journal, /"0014_daily_streaks"/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /GRANT SELECT ON public\.user_streaks TO authenticated;/);
  assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|ALL) ON public\.user_streaks TO authenticated/);
  assert.match(
    sql,
    /date_trunc\('month', s\.freeze_used_on\) <> date_trunc\('month', p_today - 1\)/,
  );
  assert.match(sql, /p_today < utc_today - 1 or p_today > utc_today \+ 1/);
  assert.match(sql, /tag like 'streak:' \|\| p_today::text \|\| ':%'/);
  // No new cron job: the reminder uses the existing queue.
  assert.doesNotMatch(sql, /cron\.schedule/);

  const dispatch = readFileSync(
    new URL("../src/routes/api/public/push/dispatch.ts", import.meta.url),
    "utf8",
  );
  // Queued before quiet hours or Canvas can end the check, like class reminders.
  assert.ok(
    dispatch.indexOf("await enqueueStreakReminder(") < dispatch.indexOf("if (isQuiet(prefs, tz))"),
  );
  // The sender re-checks: opened after it was queued means not sent.
  assert.match(dispatch, /last >= r\.tag\.split\(":"\)\[1\]/);
});
