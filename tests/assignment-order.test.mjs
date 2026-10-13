import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignmentDueTime,
  compareByDueDate,
  isAssignmentVisible,
  isPlaceholderAssignment,
} from "../src/lib/assignment-window.ts";

const item = (id, name, due_at, points_possible = 10) => ({
  id,
  name,
  due_at,
  points_possible,
  course_id: 1,
  course_name: "Course",
  course_code: "C",
  submission: null,
});

test("due dates distinguish a valid epoch from missing or malformed values", () => {
  for (const due_at of [null, "", "not-a-date"]) {
    assert.equal(assignmentDueTime({ due_at }), null);
  }
  assert.equal(assignmentDueTime({ due_at: "1970-01-01T00:00:00Z" }), 0);
});

test("malformed due dates sort with undated work and keep comparisons consistent", () => {
  const bad = item(1, "Alpha", "not-a-date");
  const dated = item(2, "Quiz", "2026-10-12T23:59:00Z");
  const undated = item(3, "Beta", null);
  assert.equal(compareByDueDate(bad, bad), 0);
  assert.equal(compareByDueDate(bad, dated), 1);
  assert.equal(compareByDueDate(dated, bad), -1);
  assert.deepEqual([bad, undated, dated].sort(compareByDueDate).map((a) => a.id), [2, 1, 3]);
  assert.deepEqual([undated, dated, bad].sort(compareByDueDate).map((a) => a.id), [2, 1, 3]);
});

test("agenda order is by due date across classes, undated last", () => {
  const list = [
    item(1, "Prof. Mtg #1", "2026-12-01T23:59:00Z"),
    item(2, "Lab 6 Pre-Lab Quiz", "2026-10-12T23:59:00Z"),
    item(3, "Lab 3", null, 100),
    item(4, "CA06 - Friction", "2026-10-11T23:59:00Z"),
  ];
  assert.deepEqual(
    [...list].sort(compareByDueDate).map((a) => a.id),
    [4, 2, 1, 3],
  );
});

test("zero-point items with no due date are placeholders and hidden by default", () => {
  const checkpoint = item(5, "Mid-Term Grade Checkpoint", null, 0);
  assert.equal(isPlaceholderAssignment(checkpoint), true);
  assert.equal(isAssignmentVisible(checkpoint, false), false);
  assert.equal(isAssignmentVisible(checkpoint, false, true), true);
  const undatedLab = item(6, "Lab 3", null, 100);
  assert.equal(isPlaceholderAssignment(undatedLab), false);
  assert.equal(isAssignmentVisible(undatedLab, false), true);
});
