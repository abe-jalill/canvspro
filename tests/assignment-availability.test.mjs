import assert from "node:assert/strict";
import test from "node:test";
import { notYetOpen, opensLabel } from "../src/lib/assignment-availability.ts";

const now = Date.parse("2026-10-13T14:00:00Z"); // Tue Oct 13, 10:00 AM Eastern

test("an assignment whose unlock date is ahead is not open yet", () => {
  assert.equal(notYetOpen({ unlock_at: "2026-10-14T13:00:00Z" }, now), true);
});

test("past, missing or malformed unlock dates count as open", () => {
  assert.equal(notYetOpen({ unlock_at: "2026-10-12T13:00:00Z" }, now), false);
  assert.equal(notYetOpen({ unlock_at: null }, now), false);
  assert.equal(notYetOpen({}, now), false);
  assert.equal(notYetOpen({ unlock_at: "not a date" }, now), false);
});

test("the label says when it opens, in the student's time zone", () => {
  const at = new Date(now);
  const tz = "America/New_York";
  assert.equal(opensLabel("2026-10-13T20:30:00Z", at, tz), "Opens today at 4:30 PM");
  assert.equal(opensLabel("2026-10-14T13:00:00Z", at, tz), "Opens tomorrow at 9:00 AM");
  assert.equal(opensLabel("2026-10-20T13:00:00Z", at, tz), "Opens Tue, Oct 20 at 9:00 AM");
  // 11:30 PM Eastern is already the next day in UTC; it still reads as today.
  assert.equal(opensLabel("2026-10-14T03:30:00Z", at, tz), "Opens today at 11:30 PM");
});
