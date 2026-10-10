import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildClassCountdownAlerts } from "../src/lib/countdown-alerts.server.ts";

const prefs = {
  countdownClass: true,
  countdownLeads: [15],
  countdownTonight: false,
  countdownTonightHours: [],
  badge: false,
};
// Thursday Oct 8 2026, 10:00 AM class, US Eastern (UTC-4 → offset 240).
const physics = {
  title: "Physics",
  days: ["T", "R"],
  start_minutes: 600,
  end_minutes: 675,
  location: "Room 101",
};

test("a 15-minute class reminder is due 15 minutes before class", () => {
  const rows = buildClassCountdownAlerts([physics], prefs, 240, new Date("2026-10-08T12:00:00Z"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fire_at, "2026-10-08T13:45:00.000Z"); // 9:45 AM Eastern
  assert.equal(rows[0].title, "Physics starts in 15 min");
});

test("every chosen lead time gets its own reminder at the right moment", () => {
  const rows = buildClassCountdownAlerts(
    [physics],
    { ...prefs, countdownLeads: [60, 5, 0] },
    240,
    new Date("2026-10-08T12:00:00Z"),
  );
  assert.deepEqual(
    rows.map((r) => [r.fire_at, r.title]),
    [
      ["2026-10-08T13:00:00.000Z", "Physics starts in 1 hour"],
      ["2026-10-08T13:55:00.000Z", "Physics starts in 5 min"],
      ["2026-10-08T14:00:00.000Z", "Physics starts now"],
    ],
  );
});

test("queued reminders are sent by a 5-minute run, not the 30-minute check", () => {
  const dispatch = readFileSync(
    new URL("../src/routes/api/public/push/dispatch.ts", import.meta.url),
    "utf8",
  );
  // The 30-minute check only queues countdowns; it must not send them late.
  const enqueue = dispatch.slice(
    dispatch.indexOf("async function enqueueCountdowns"),
    dispatch.indexOf("const SCHEDULED_GRACE_MS"),
  );
  assert.ok(!enqueue.includes('.lte("fire_at"'));
  assert.match(dispatch, /if \(action === "scheduled"\) return runScheduled\(\);/);
  // Late reminders would show the wrong countdown, so they are dropped.
  assert.match(dispatch, /const SCHEDULED_GRACE_MS = 6 \* 60_000;/);
  // Settings are re-checked at send time: a lead turned off since queueing is skipped.
  assert.ok(dispatch.includes(".filter((r) => scheduledAlertAllowed(r.tag, prefs))"));
  const pushServer = readFileSync(
    new URL("../src/lib/push-dispatch.server.ts", import.meta.url),
    "utf8",
  );
  assert.ok(pushServer.includes("prefs.countdownLeads.includes(Number(tag.split(\":\").pop()))"));

  const migration = readFileSync(
    new URL("../drizzle/migrations/0011_push_scheduled_every_5_minutes.sql", import.meta.url),
    "utf8",
  );
  assert.ok(migration.includes("'*/5 10-23,0-3 * * *'"));
  assert.ok(migration.includes("jsonb_build_object('action', 'scheduled')"));
  const journal = JSON.parse(
    readFileSync(new URL("../drizzle/migrations/meta/_journal.json", import.meta.url), "utf8"),
  );
  assert.ok(journal.entries.some((e) => e.tag === "0011_push_scheduled_every_5_minutes"));
});
