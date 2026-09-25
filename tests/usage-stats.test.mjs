import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summarizeUsageActivity,
  utcDate,
  utcMonthStart,
  utcWeekStart,
} from "../src/lib/usage-stats.ts";

const now = new Date("2026-09-25T15:30:00.000Z");

const row = (user, date, interactions = 1) => ({
  user_id: user,
  activity_date: date,
  last_seen_at: `${date}T15:00:00.000Z`,
  interactions,
});

test("usage summary counts unique users and visits for today, week, and month", () => {
  const summary = summarizeUsageActivity(
    [
      row("a", "2026-09-25", 2),
      row("b", "2026-09-25", 1),
      row("a", "2026-09-24", 3),
      row("c", "2026-09-21", 4),
      row("d", "2026-09-20", 5),
      row("e", "2026-09-01", 6),
      row("f", "2026-08-31", 7),
    ],
    now,
  );

  assert.deepEqual(summary.today, { users: 2, interactions: 3 });
  assert.deepEqual(summary.week, { users: 3, interactions: 10 });
  assert.deepEqual(summary.month, { users: 5, interactions: 21 });
  assert.equal(summary.daily.length, 30);
  assert.deepEqual(summary.daily.at(-1), { date: "2026-09-25", users: 2, interactions: 3 });
});

test("usage period boundaries are stable UTC dates", () => {
  assert.equal(utcDate(now), "2026-09-25");
  assert.equal(utcWeekStart(now), "2026-09-21");
  assert.equal(utcMonthStart(now), "2026-09-01");
});
