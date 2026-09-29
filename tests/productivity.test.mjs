import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeProductivity } from "../src/lib/productivity.ts";
import { completedAssignmentIds, completionRecords } from "../src/lib/completion-records.ts";

const now = new Date(2026, 8, 22, 12);
const date = (d, h = 10) => new Date(2026, 8, d, h).toISOString();
const assignment = (id, due, name = "Homework", submission = {}) => ({ id, course_id: 1, name, due_at: due, submission, points_possible: 10 });

test("counts dated completions once and does not invent dates for legacy checkmarks", () => {
  const prefs = {
    "completed-assignments": ["1", "2"],
    "assignment-completion:2": { completed: true, completedAt: date(21), dueAt: date(20) },
    "assignment-completion:3": { completed: false, completedAt: null, dueAt: date(23) },
  };
  const summary = summarizeProductivity([
    assignment(1, date(18)), assignment(2, date(20), "Paper", { submitted_at: date(21) }),
    assignment(3, date(23)), assignment(4, date(21), "Quiz", { submitted_at: date(20) }),
  ], completedAssignmentIds(prefs), completionRecords(prefs), new Map(), now);
  assert.equal(summary.completed, 2);
  assert.equal(summary.overdueCleared, 1);
  assert.equal(summary.upcoming, 1);
});

test("busiest upcoming day uses the next seven days, excludes completed work and handles ties", () => {
  const summary = summarizeProductivity([
    assignment(1, date(27)), assignment(2, date(28)), assignment(3, date(28)),
    assignment(4, date(29)), assignment(5, date(29)), assignment(6, date(28)),
  ], new Set(["6"]), {}, new Map(), now);
  assert.deepEqual(summary.busiest, { date: "2026-09-28", count: 2 });
});

test("coming-up and busiest-day metrics share the Focus one-week boundary", () => {
  const summary = summarizeProductivity([
    assignment(1, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()),
    assignment(2, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 1).toISOString()),
  ], new Set(), {}, new Map(), now);
  assert.equal(summary.upcoming, 2);
  assert.deepEqual(summary.busiest, { date: "2026-09-29", count: 2 });
});

test("detects major-task collisions and crowded days, suggesting no date in the past", () => {
  const summary = summarizeProductivity([
    assignment(1, date(22, 18), "Final exam"), assignment(2, date(22, 20), "Project"),
    assignment(3, date(24)), assignment(4, date(24)), assignment(5, date(24)),
    assignment(6, "invalid"), assignment(7, null),
  ], new Set(), {}, new Map([[2, 120]]), now);
  assert.equal(summary.warnings.length, 2);
  assert.equal(summary.warnings[0].suggested.id, 2);
  assert.equal(summary.warnings[0].start.toDateString(), now.toDateString());
});

test("per-assignment overrides preserve legacy data and support undo", () => {
  const prefs = { "completed-assignments": ["1", "2"],
    "assignment-completion:1": { completed: false, completedAt: null },
    "assignment-completion:3": { completed: true, completedAt: date(22) } };
  assert.deepEqual([...completedAssignmentIds(prefs)].sort(), ["2", "3"]);
});
