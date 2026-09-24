import { test } from "node:test";
import assert from "node:assert/strict";
import { isFocusWindow, isInFocusWindow } from "../src/lib/focus-window.ts";

const now = Date.parse("2026-09-23T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;
const assignment = (due, submission = {}) => ({
  id: 1,
  due_at: new Date(due).toISOString(),
  submission,
});

test("accepts only the five Focus windows", () => {
  for (const value of ["7", "overdue", "3", "2", "1"]) assert.equal(isFocusWindow(value), true);
  for (const value of ["today", "8", "", undefined]) assert.equal(isFocusWindow(value), false);
});

test("overdue is separate from every upcoming window", () => {
  const late = assignment(now - 10 * day);
  assert.equal(isInFocusWindow(late, "overdue", now, false), true);
  for (const window of ["1", "2", "3", "7"]) {
    assert.equal(isInFocusWindow(late, window, now, false), false);
  }
});

test("upcoming windows use matching rolling day boundaries", () => {
  assert.equal(isInFocusWindow(assignment(now + day), "1", now, false), true);
  assert.equal(isInFocusWindow(assignment(now + day + 1), "1", now, false), false);
  assert.equal(isInFocusWindow(assignment(now + 2 * day), "2", now, false), true);
  assert.equal(isInFocusWindow(assignment(now + 3 * day), "3", now, false), true);
  assert.equal(isInFocusWindow(assignment(now + 7 * day), "7", now, false), true);
  assert.equal(isInFocusWindow(assignment(now + 7 * day + 1), "7", now, false), false);
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
  assert.equal(isInFocusWindow(assignment(now + day, { workflow_state: "graded" }), "7", now, false), false);
  assert.equal(isInFocusWindow({ ...due, due_at: null }, "7", now, false), false);
});
