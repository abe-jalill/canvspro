import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  canvasSaysComplete,
  isAssignmentComplete,
  isAssignmentVisible,
  setReopenedAssignments,
} from "../src/lib/assignment-window.ts";
import {
  completedAssignmentIds,
  reopenedAssignmentTimes,
} from "../src/lib/completion-records.ts";
import { buildPriorityQueue } from "../src/lib/get-it-done.ts";

const now = Date.parse("2026-10-05T12:00:00.000Z");
const iso = (hours) => new Date(now + hours * 3_600_000).toISOString();
const item = (id, due, submission) => ({
  id,
  course_id: 1,
  course_name: "Physics",
  course_code: "PHY",
  name: `Task ${id}`,
  due_at: due,
  html_url: "",
  points_possible: 10,
  submission,
});
const submittedAt = (hours) => ({ workflow_state: "submitted", submitted_at: iso(hours) });

beforeEach(() => setReopenedAssignments(new Map()));

test("Canvas-submitted work is done until it is reopened", () => {
  const a = item(1, iso(24), submittedAt(-5));
  assert.equal(canvasSaysComplete(a), true);
  assert.equal(isAssignmentComplete(a, false), true);
});

test("reopening Canvas-submitted work marks it not done", () => {
  const a = item(1, iso(24), submittedAt(-5));
  setReopenedAssignments(new Map([["1", now]]));
  assert.equal(isAssignmentComplete(a, false), false);
  // Still treated as unfinished work by the shared visibility rule.
  assert.equal(isAssignmentVisible(a, false, false, now), true);
});

test("a reopen only affects that assignment", () => {
  setReopenedAssignments(new Map([["1", now]]));
  assert.equal(isAssignmentComplete(item(2, iso(24), submittedAt(-5)), false), true);
});

test("a real resubmission after reopening puts it back to done", () => {
  const resubmitted = item(1, iso(24), submittedAt(2)); // submitted after the reopen at `now`
  setReopenedAssignments(new Map([["1", now]]));
  assert.equal(isAssignmentComplete(resubmitted, false), true);
});

test("marking it done yourself always wins", () => {
  setReopenedAssignments(new Map([["1", now]]));
  assert.equal(isAssignmentComplete(item(1, iso(24), submittedAt(-5)), true), true);
});

test("reopening never turns unsubmitted work into done", () => {
  const a = item(1, iso(24), { workflow_state: "unsubmitted" });
  setReopenedAssignments(new Map([["1", now]]));
  assert.equal(isAssignmentComplete(a, false), false);
});

test("reopened times are read from saved completion records", () => {
  const preferences = {
    "assignment-completion:11": { completed: false, completedAt: null, dueAt: null, reopenedAt: iso(0) },
    "assignment-completion:12": { completed: false, completedAt: null, dueAt: null },
    "assignment-completion:13": { completed: true, completedAt: iso(0), dueAt: null, reopenedAt: iso(-9) },
    "assignment-completion:14": { completed: false, completedAt: null, dueAt: null, reopenedAt: "nonsense" },
  };
  const times = reopenedAssignmentTimes(preferences);
  assert.deepEqual([...times.keys()], ["11"]);
  assert.equal(times.get("11"), now);
  // A plain not-done record and a reopen are both "not completed" for the manual set.
  assert.equal(completedAssignmentIds(preferences).has("11"), false);
  assert.equal(completedAssignmentIds(preferences).has("13"), true);
});

test("the priority list leaves out work with no due date", () => {
  const queue = buildPriorityQueue({
    assignments: [
      item(1, iso(10), {}),
      item(2, null, {}),
      { ...item(3, null, {}), points_possible: 100 },
    ],
    completed: () => false,
    now,
  });
  assert.deepEqual(queue.map((entry) => entry.assignment.id), [1]);
});
