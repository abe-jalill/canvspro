import assert from "node:assert/strict";
import test from "node:test";
import { dueLabel } from "../src/lib/countdown-alerts.server.ts";
import { notificationCourseName } from "../src/lib/course-display.ts";

// Noon on Oct 14 in New York (UTC-4, so the offset is 240 minutes).
const now = new Date("2026-10-14T16:00:00Z");
const ny = 240;

test("due times read the way a person says them, in the student's time zone", () => {
  assert.equal(dueLabel(new Date("2026-10-14T23:30:00Z"), now, ny), "today at 7:30 PM");
  assert.equal(dueLabel(new Date("2026-10-15T13:00:00Z"), now, ny), "tomorrow at 9:00 AM");
  assert.equal(dueLabel(new Date("2026-10-18T03:59:00Z"), now, ny), "10/17 at 11:59 PM");
});

test("due times have no seconds, no leading zero and no year", () => {
  for (const due of ["2026-10-14T23:30:00Z", "2026-10-15T11:05:00Z", "2026-12-02T14:00:00Z"]) {
    const label = dueLabel(new Date(due), now, ny);
    assert.doesNotMatch(label, /2026/);
    assert.doesNotMatch(label, /\d:\d\d:\d\d/);
    assert.doesNotMatch(label, /(^|\s)0\d/);
  }
});

test("a late-night deadline stays on the student's day, not UTC's", () => {
  // 11:59 PM in New York is already tomorrow in UTC.
  assert.equal(dueLabel(new Date("2026-10-15T03:59:00Z"), now, ny), "today at 11:59 PM");
});

test("notifications use the class nickname when there is one", () => {
  assert.equal(notificationCourseName("Bio", "BIOLOGY 101: CELLS AND GENES (SEC 02) FALL 2026", "BIO-101-02"), "Bio");
  assert.equal(notificationCourseName("  Physics  ", "University Physics 1", "PHY"), "Physics");
});

test("without a nickname they use the same cleaned-up name as the app", () => {
  assert.equal(notificationCourseName(null, "UNIVERSITY PHYSICS 1", "PHY 2213"), "University Physics 1");
  assert.equal(notificationCourseName("", "College Writing", "ENG 102"), "College Writing");
});
