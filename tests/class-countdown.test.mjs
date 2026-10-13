import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildClassCountdownAlerts,
  planScheduledAlerts,
} from "../src/lib/countdown-alerts.server.ts";

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
  // Past the grace window a reminder's countdown is recalculated, not sent stale.
  assert.match(dispatch, /const SCHEDULED_GRACE_MS = 6 \* 60_000;/);
  assert.ok(dispatch.includes("planScheduledAlerts(queued, new Date(now), SCHEDULED_GRACE_MS)"));
  // Handled reminders are marked, and only unhandled ones are looked up or flagged.
  assert.ok(dispatch.includes('.is("sent_at", null)'));
  const health = readFileSync(
    new URL("../src/routes/api/public/push/health.ts", import.meta.url),
    "utf8",
  );
  assert.ok(health.includes('.is("sent_at", null)'));
  // Settings are re-checked at send time: a lead turned off since queueing is skipped.
  assert.ok(dispatch.includes(".filter((r) => scheduledAlertAllowed(r.tag, prefs))"));
  const pushServer = readFileSync(
    new URL("../src/lib/push-dispatch.server.ts", import.meta.url),
    "utf8",
  );
  assert.ok(pushServer.includes('prefs.countdownLeads.includes(Number(tag.split(":").pop()))'));

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

const GRACE = 6 * 60_000;
// Physics at 10:00 AM Eastern (14:00Z) with 15- and 5-minute reminders.
const q15 = {
  tag: "class:2026-10-08:600:Physics:15",
  fire_at: "2026-10-08T13:45:00.000Z",
  title: "Physics starts in 15 min",
};
const q5 = {
  tag: "class:2026-10-08:600:Physics:5",
  fire_at: "2026-10-08T13:55:00.000Z",
  title: "Physics starts in 5 min",
};

test("an on-time reminder goes out exactly as queued", () => {
  const plan = planScheduledAlerts([q15], new Date("2026-10-08T13:47:00Z"), GRACE);
  assert.deepEqual(plan, { send: [q15], drop: [] });
});

test("a missed run still sends the reminder, with the countdown recalculated", () => {
  const plan = planScheduledAlerts([q15], new Date("2026-10-08T13:53:00Z"), GRACE);
  assert.equal(plan.send.length, 1);
  assert.equal(plan.send[0].title, "Physics starts in 7 min");
  assert.equal(plan.send[0].tag, q15.tag);
});

test("once class has started a late reminder is dropped, never sent", () => {
  const plan = planScheduledAlerts([q15], new Date("2026-10-08T14:01:00Z"), GRACE);
  assert.deepEqual(plan, { send: [], drop: [q15] });
});

test("when two steps for one class are due, only the latest goes out", () => {
  const plan = planScheduledAlerts([q15, q5], new Date("2026-10-08T13:56:00Z"), GRACE);
  assert.deepEqual(plan, { send: [q5], drop: [q15] });
});

test("a 'starts now' reminder still goes out within the grace window", () => {
  const now0 = {
    tag: "class:2026-10-08:600:Physics:0",
    fire_at: "2026-10-08T14:00:00.000Z",
    title: "Physics starts now",
  };
  assert.deepEqual(planScheduledAlerts([now0], new Date("2026-10-08T14:03:00Z"), GRACE).send, [
    now0,
  ]);
  assert.deepEqual(planScheduledAlerts([now0], new Date("2026-10-08T14:10:00Z"), GRACE).drop, [
    now0,
  ]);
});

test("class titles with colons and tonight reminders are handled", () => {
  const colon = {
    tag: "class:2026-10-08:600:CS 101: Intro:15",
    fire_at: "2026-10-08T13:45:00.000Z",
    title: "CS 101: Intro starts in 15 min",
  };
  assert.equal(
    planScheduledAlerts([colon], new Date("2026-10-08T13:50:00Z"), 2 * 60_000).send[0].title,
    "CS 101: Intro starts in 10 min",
  );
  // 9 PM Eastern reminder (01:00Z next day); the deadline is 11:59 PM Eastern.
  const tonight = {
    tag: "tonight:2026-10-08:21",
    fire_at: "2026-10-09T01:00:00.000Z",
    title: "Due tonight by 11:59 PM: Lab",
  };
  assert.deepEqual(planScheduledAlerts([tonight], new Date("2026-10-09T02:00:00Z"), GRACE).send, [
    tonight,
  ]);
  assert.deepEqual(planScheduledAlerts([tonight], new Date("2026-10-09T04:00:00Z"), GRACE).drop, [
    tonight,
  ]);
});

test("reminders that aren't due yet are left alone", () => {
  assert.deepEqual(planScheduledAlerts([q5], new Date("2026-10-08T13:50:00Z"), GRACE), {
    send: [],
    drop: [],
  });
});
