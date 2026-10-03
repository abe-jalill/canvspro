import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
