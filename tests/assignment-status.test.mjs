import { test } from "node:test";
import assert from "node:assert/strict";
import { isAssignmentComplete } from "../src/lib/assignment-window.ts";
import { isDueInFocusWindow, isInFocusWindow } from "../src/lib/focus-window.ts";
import { buildPriorityList } from "../src/lib/priority.ts";

const now = new Date(2026, 8, 26, 10).getTime();
const assignment = (id, submission) => ({
  id, course_id: 1, course_name: "Physics", course_code: "PHY",
  name: `Task ${id}`, due_at: new Date(now + 86400000).toISOString(),
  html_url: "", points_possible: 10, submission,
});

test("Canvas missing zeros and cleared grades remain actionable", () => {
  const missing = assignment(1, { workflow_state: "graded", score: 0, missing: true });
  const cleared = assignment(2, { workflow_state: "graded", score: null, grade: null });
  const unsubmitted = assignment(3, { workflow_state: "unsubmitted", score: 0 });
  for (const item of [missing, cleared, unsubmitted]) {
    assert.equal(isAssignmentComplete(item, false), false);
    assert.equal(isInFocusWindow(item, "7", now, false), true);
  }
  const groups = buildPriorityList([missing, cleared, unsubmitted], [], () => false, now);
  assert.equal(groups[0].items.length, 3);
});

test("submitted, pending review, excused, and actual graded work are complete", () => {
  for (const submission of [
    { workflow_state: "submitted" },
    { workflow_state: "pending_review" },
    { submitted_at: new Date(now).toISOString() },
    { excused: true },
    { workflow_state: "graded", score: 0 },
    { workflow_state: "graded", grade: "complete" },
  ]) assert.equal(isAssignmentComplete(assignment(1, submission), false), true);
});

test("completion can be reviewed without changing date filters and undone", () => {
  const item = assignment(1, {});
  assert.equal(isInFocusWindow(item, "7", now, true), false);
  assert.equal(isDueInFocusWindow(item, "7", now), true);
  assert.equal(isInFocusWindow(item, "7", now, false), true);
});

test("all dates includes custom, undated, overdue, and distant assignments", () => {
  const items = [
    assignment(-1, undefined),
    { ...assignment(2, {}), due_at: null },
    { ...assignment(3, {}), due_at: new Date(now - 86400000).toISOString() },
    { ...assignment(4, {}), due_at: new Date(now + 60 * 86400000).toISOString() },
  ];
  assert.equal(items.filter((item) => isInFocusWindow(item, "all", now, false)).length, 4);
  assert.equal(items.filter((item) => isInFocusWindow(item, "7", now, false)).length, 1);
});
