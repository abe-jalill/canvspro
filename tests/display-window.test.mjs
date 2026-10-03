import { test } from "node:test";
import assert from "node:assert/strict";
import {
  endOfAheadWindow,
  isAssignmentVisible,
  isInDisplayWindow,
  isStaleOverdue,
  startOfRecentWindow,
} from "../src/lib/assignment-window.ts";
import { isDueInFocusWindow } from "../src/lib/focus-window.ts";

// Mon Oct 5 2026, noon local time.
const now = new Date(2026, 9, 5, 12).getTime();
const day = 24 * 60 * 60 * 1000;
const at = (offsetDays, hour = 12) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const item = (due, submission) => ({
  id: 1,
  course_id: 1,
  course_name: "Physics",
  course_code: "PHY",
  name: "Task",
  due_at: due,
  html_url: "",
  points_possible: 10,
  submission,
});
const SUBMITTED = { workflow_state: "submitted", submitted_at: "2026-09-01T00:00:00Z" };

test("the window runs from the start of 3 days ago to the end of day 28", () => {
  const start = new Date(startOfRecentWindow(now));
  assert.equal(start.getDate(), 2); // Oct 5 minus 3 days
  assert.equal(start.getHours(), 0);
  const end = new Date(endOfAheadWindow(now));
  assert.equal(end.getMonth(), 10); // Nov 2
  assert.equal(end.getDate(), 2);
  assert.equal(end.getHours(), 23);
});

test("work due inside the window is in, outside it is out", () => {
  assert.equal(isInDisplayWindow(item(at(-3, 8)), now), true);
  assert.equal(isInDisplayWindow(item(at(-4, 23)), now), false);
  assert.equal(isInDisplayWindow(item(at(0)), now), true);
  assert.equal(isInDisplayWindow(item(at(28, 23)), now), true);
  assert.equal(isInDisplayWindow(item(at(29, 1)), now), false);
  assert.equal(isInDisplayWindow(item(null), now), false);
});

test("submitted work from the start of term never shows, even when asked for", () => {
  const old = item(at(-60), SUBMITTED);
  assert.equal(isAssignmentVisible(old, false, true, now), false);
  assert.equal(isAssignmentVisible(old, false, false, now), false);
});

test("submitted work in the window shows only when asked for", () => {
  const recent = item(at(-2), SUBMITTED);
  assert.equal(isAssignmentVisible(recent, false, false, now), false);
  assert.equal(isAssignmentVisible(recent, false, true, now), true);
  const soon = item(at(10), SUBMITTED);
  assert.equal(isAssignmentVisible(soon, false, true, now), true);
});

test("submitted work due beyond four weeks stays hidden", () => {
  assert.equal(isAssignmentVisible(item(at(40), SUBMITTED), false, true, now), false);
});

test("unfinished work stays for three days after its deadline, then drops off", () => {
  assert.equal(isStaleOverdue(item(at(-2)), now), false);
  assert.equal(isStaleOverdue(item(at(-3, 9)), now), false);
  assert.equal(isStaleOverdue(item(at(-4, 22)), now), true);
  assert.equal(isAssignmentVisible(item(at(-2)), false, false, now), true);
  assert.equal(isAssignmentVisible(item(at(-5)), false, false, now), false);
});

test("Focus 'all' stops four weeks out but keeps undated work", () => {
  assert.equal(isDueInFocusWindow(item(at(27)), "all", now), true);
  assert.equal(isDueInFocusWindow(item(at(45)), "all", now), false);
  assert.equal(isDueInFocusWindow(item(null), "all", now), true);
});

test("a day is a day", () => {
  assert.equal(day, 86_400_000);
});
