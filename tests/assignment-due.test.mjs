import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeDueDay, formatAssignmentDue, dueTodayClass } from "../src/lib/assignment-due.ts";
import { getCountdown } from "../src/lib/countdown.ts";
import { mergeAssignments } from "../src/lib/assignment-sources.ts";
import { defaultEstimateMinutes } from "../src/lib/get-it-done.ts";
import { isInFocusWindow } from "../src/lib/focus-window.ts";

test("Today and Tomorrow follow local calendar days, including DST and year boundaries", () => {
  for (const now of [new Date(2026, 2, 8, 0, 30), new Date(2026, 10, 1, 0, 30), new Date(2026, 11, 31, 23, 30)]) {
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(23, 59);
    assert.equal(relativeDueDay(now.toISOString(), +now), "Today");
    assert.equal(relativeDueDay(tomorrow.toISOString(), +now), "Tomorrow");
    assert.match(formatAssignmentDue(tomorrow.toISOString(), +now), /^Tomorrow · /);
    assert.equal(formatAssignmentDue(now.toISOString(), +now, false), "Today");
  }
  assert.equal(relativeDueDay("invalid"), null);
  assert.equal(formatAssignmentDue(null), "No due date");
});

test("today stays labelled Today and highlighted after the deadline; finished work stays quiet", () => {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const due = today.toISOString();
  assert.equal(getCountdown(due).label, "Today");
  assert.match(getCountdown(due).fullDate, /^Today · /);
  assert.equal(getCountdown(due, { completed: true }).label, "Today");
  assert.notEqual(dueTodayClass(due, false, +now), "");
  assert.equal(dueTodayClass(due, true, +now), "");
  assert.equal(dueTodayClass(tomorrow.toISOString(), false, +now), "");
});

test("manual work joins Canvas work in Focus and retains its time estimate and course", () => {
  const now = +new Date(2026, 9, 18, 10);
  const canvas = { id: 1, due_at: new Date(now + 3600000).toISOString() };
  const manual = { id: -1, course_id: 7, name: "Reading", due_at: new Date(now + 7200000).toISOString(), points_possible: null, notes: "Chapter 2", estimated_minutes: 75 };
  const merged = mergeAssignments([canvas], [manual], [{ id: 7, name: "Writing", course_code: "ENG" }]);
  const focus = merged.filter((item) => isInFocusWindow(item, "2", now, false));
  assert.deepEqual(focus.map((item) => item.id), [1, -1]);
  assert.equal(focus[1].course_name, "Writing");
  assert.equal(focus[1].description, "Chapter 2");
  assert.equal(defaultEstimateMinutes(focus[1]), 75);
  assert.equal(isInFocusWindow(focus[1], "2", now, true), false);
  assert.equal(defaultEstimateMinutes({ points_possible: 50 }), 60);
  assert.equal(defaultEstimateMinutes({ estimated_minutes: -5, points_possible: null }), 30);
});
