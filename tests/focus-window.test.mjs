import { test } from "node:test";
import assert from "node:assert/strict";
import { isFocusWindow, isInFocusWindow } from "../src/lib/focus-window.ts";
import { isAssignmentComplete } from "../src/lib/assignment-window.ts";
import { filterAssignmentsForUpcomingWindow } from "../src/lib/get-it-done.ts";

const now = Date.parse("2026-09-23T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;
const assignment = (due, submission = {}) => ({
  id: 1,
  due_at: new Date(due).toISOString(),
  submission,
});

test("accepts the Focus windows including all dates", () => {
  for (const value of ["all", "7", "overdue", "3", "2", "1"]) assert.equal(isFocusWindow(value), true);
  for (const value of ["today", "8", "", undefined]) assert.equal(isFocusWindow(value), false);
});

test("overdue is separate from every upcoming window", () => {
  const late = assignment(now - 10 * day);
  assert.equal(isInFocusWindow(late, "overdue", now, false), true);
  for (const window of ["1", "2", "3", "7"]) {
    assert.equal(isInFocusWindow(late, window, now, false), false);
  }
});

test("short windows roll forward while one week includes the full seventh calendar day", () => {
  assert.equal(isInFocusWindow(assignment(now + day), "1", now, false), true);
  assert.equal(isInFocusWindow(assignment(now + day + 1), "1", now, false), false);
  assert.equal(isInFocusWindow(assignment(now + 2 * day), "2", now, false), true);
  assert.equal(isInFocusWindow(assignment(now + 3 * day), "3", now, false), true);
  assert.equal(isInFocusWindow(assignment(now + 7 * day), "7", now, false), true);
  const seventhDayLate = new Date(2026, 8, 30, 23, 59).getTime();
  assert.equal(isInFocusWindow(assignment(seventhDayLate), "7", now, false), true);
  assert.equal(isInFocusWindow(assignment(new Date(2026, 9, 1).getTime()), "7", now, false), false);
});

test("completed and submitted work never appears in Focus counts", () => {
  const due = assignment(now + day);
  assert.equal(isInFocusWindow(due, "7", now, true), false);
  assert.equal(
    isInFocusWindow(
      assignment(now - day, { submitted_at: new Date(now).toISOString() }),
      "overdue",
      now,
      false,
    ),
    false,
  );
  assert.equal(isInFocusWindow(assignment(now + day, { workflow_state: "graded", score: 10 }), "7", now, false), false);
  assert.equal(isInFocusWindow(assignment(now + day, { score: 0 }), "7", now, false), true);
  assert.equal(isInFocusWindow({ ...due, due_at: null }, "7", now, false), false);
});

test("three unfinished class assignments due this week appear in Focus and Get It Done", () => {
  const dueTimes = [
    new Date(2026, 8, 24, 18).getTime(),
    new Date(2026, 8, 27, 23, 59).getTime(),
    new Date(2026, 8, 30, 23, 59).getTime(),
  ];
  const assignments = dueTimes.map((due, index) => ({
    ...assignment(due), id: index + 1, course_id: 4,
  }));

  assert.equal(assignments.filter((a) => !isAssignmentComplete(a, false)).length, 3);
  assert.equal(assignments.filter((a) => isInFocusWindow(a, "7", now, false)).length, 3);
  assert.equal(filterAssignmentsForUpcomingWindow(assignments, now, 7).length, 3);
});
