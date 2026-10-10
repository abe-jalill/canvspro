import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  lastExpectedDispatch,
  nextFailStreak,
  pushHealthProblems,
  readAccountCheck,
} from "../src/lib/push-health.ts";

const at = (iso) => Date.parse(iso);
const healthy = { checkedAt: at("2026-10-08T14:00:04Z"), reason: "nothing-due", failStreak: 0 };

test("knows when the background check last should have run", () => {
  assert.equal(lastExpectedDispatch(at("2026-10-08T14:20:00Z")), at("2026-10-08T14:00:00Z"));
  assert.equal(lastExpectedDispatch(at("2026-10-08T14:03:00Z")), at("2026-10-08T13:30:00Z"));
  // Outside 10:00-04:00 UTC (night in Eastern time) the last run was 03:30.
  assert.equal(lastExpectedDispatch(at("2026-10-08T08:00:00Z")), at("2026-10-08T03:30:00Z"));
  assert.equal(lastExpectedDispatch(at("2026-10-08T10:02:00Z")), at("2026-10-08T03:30:00Z"));
});

test("a working pipeline reports no problems", () => {
  assert.deepEqual(
    pushHealthProblems({ now: at("2026-10-08T14:20:00Z"), checks: [healthy], overdueReminders: 0 }),
    [],
  );
  // No devices registered anywhere is not an outage.
  assert.deepEqual(
    pushHealthProblems({ now: at("2026-10-08T14:20:00Z"), checks: [], overdueReminders: 0 }),
    [],
  );
  // Overnight the check is paused on purpose.
  assert.deepEqual(
    pushHealthProblems({
      now: at("2026-10-08T08:20:00Z"),
      checks: [{ ...healthy, checkedAt: at("2026-10-08T03:30:05Z") }],
      overdueReminders: 0,
    }),
    [],
  );
});

test("catches the cron job no longer running", () => {
  const stale = { ...healthy, checkedAt: at("2026-10-08T12:00:04Z") };
  assert.deepEqual(
    pushHealthProblems({ now: at("2026-10-08T14:20:00Z"), checks: [stale], overdueReminders: 0 }),
    ["dispatch-not-running"],
  );
});

test("catches every check failing (the redirect: 'error' outage), but not one hiccup", () => {
  const once = { ...healthy, reason: "error", failStreak: 1 };
  const twice = { ...healthy, reason: "error", failStreak: 2 };
  const now = at("2026-10-08T14:20:00Z");
  assert.deepEqual(pushHealthProblems({ now, checks: [once], overdueReminders: 0 }), []);
  assert.deepEqual(pushHealthProblems({ now, checks: [twice], overdueReminders: 0 }), [
    "dispatch-failing",
  ]);
  // Push keys broken: alerts were due but no device took them.
  assert.deepEqual(
    pushHealthProblems({
      now,
      checks: [{ ...healthy, reason: "delivery-failed", failStreak: 2 }],
      overdueReminders: 0,
    }),
    ["dispatch-failing"],
  );
});

test("catches Canvas refusing every account (the missing User-Agent outage)", () => {
  const now = at("2026-10-08T14:20:00Z");
  const blocked = { ...healthy, reason: "canvas-403", failStreak: 2 };
  assert.deepEqual(pushHealthProblems({ now, checks: [blocked], overdueReminders: 0 }), [
    "canvas-unreachable",
  ]);
  // One student's revoked key is their problem, not an outage.
  const rejected = { ...healthy, reason: "canvas-key-rejected", failStreak: 0 };
  assert.deepEqual(pushHealthProblems({ now, checks: [rejected], overdueReminders: 0 }), []);
  // One school down while others work is not a full outage.
  assert.deepEqual(pushHealthProblems({ now, checks: [blocked, healthy], overdueReminders: 0 }), []);
});

test("catches class and tonight reminders that came due and weren't sent", () => {
  assert.deepEqual(
    pushHealthProblems({ now: at("2026-10-08T14:20:00Z"), checks: [healthy], overdueReminders: 1 }),
    ["reminders-not-sending"],
  );
});

test("the failure streak counts consecutive troubled checks and resets on success", () => {
  assert.equal(nextFailStreak(undefined, "error"), 1);
  assert.equal(nextFailStreak({ checkedAt: "2026-10-08T13:30:00Z", failStreak: 1 }, "error"), 2);
  assert.equal(nextFailStreak({ checkedAt: "2026-10-08T13:30:00Z", failStreak: 3 }, "delivered"), 0);
  assert.equal(nextFailStreak({ checkedAt: "2026-10-08T13:30:00Z", failStreak: 3 }, "quiet-hours"), 0);
  // Heartbeats written before this change have only checkedAt.
  assert.deepEqual(readAccountCheck({ checkedAt: "2026-10-08T13:30:00Z" }), {
    checkedAt: at("2026-10-08T13:30:00Z"),
    reason: undefined,
    failStreak: 0,
  });
  assert.equal(readAccountCheck(null), null);
});

test("the health route, monitor and heartbeat stay wired together", () => {
  const route = readFileSync(
    new URL("../src/routes/api/public/push/health.ts", import.meta.url),
    "utf8",
  );
  assert.ok(route.includes('createFileRoute("/api/public/push/health")'));
  assert.ok(route.includes("pushHealthProblems({ now, checks, overdueReminders: overdue })"));
  const workflow = readFileSync(
    new URL("../.github/workflows/push-health.yml", import.meta.url),
    "utf8",
  );
  assert.ok(workflow.includes("https://canvaspro.app/api/public/push/health"));
  assert.ok(workflow.includes('cron: "20 10-23,0-3 * * *"'));
  const dispatch = readFileSync(
    new URL("../src/routes/api/public/push/dispatch.ts", import.meta.url),
    "utf8",
  );
  assert.ok(dispatch.includes("failStreak: nextFailStreak(previous, reason)"));
  assert.ok(dispatch.includes('"delivery-failed"'));
});
