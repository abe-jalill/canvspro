import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPriorityQueue,
  describePriorityQueue,
  rankGetItDoneAssignments,
  urgencyForAssignment,
} from "../src/lib/get-it-done.ts";

const now = Date.parse("2026-10-05T12:00:00.000Z");
const hours = (n) => new Date(now + n * 60 * 60 * 1000).toISOString();
const item = (id, course, due, points, name) => ({
  id,
  course_id: course,
  course_name: `Course ${course}`,
  course_code: `C${course}`,
  name,
  due_at: due,
  html_url: "",
  points_possible: points,
  submission: {},
});

// Regression: the Assignments page once used its own scorer and put a project
// due in six days above a quiz due tomorrow labelled "critical".
const assignments = [
  item(1, 1, hours(20), 10, "Quiz"),
  item(2, 1, hours(30), 100, "Exam prep"),
  item(3, 2, hours(70), 100, "Paper"),
  item(4, 2, hours(100), 50, "Lab"),
  item(5, 3, hours(6), 5, "Reading"),
  item(6, 3, hours(150), 200, "Project"),
];

test("the priority queue uses the same order as Get It Done", () => {
  const completed = () => false;
  const queue = buildPriorityQueue({ assignments, completed, now });
  const ranked = rankGetItDoneAssignments({ assignments, completed, now });
  assert.deepEqual(
    queue.map((entry) => entry.assignment.id),
    ranked.map((entry) => entry.assignment.id),
  );
});

test("tonight's work outranks heavy work that is days away", () => {
  const queue = buildPriorityQueue({ assignments, completed: () => false, now });
  const names = queue.map((entry) => entry.assignment.name);
  assert.ok(names.indexOf("Quiz") < names.indexOf("Project"));
  assert.ok(names.indexOf("Reading") < names.indexOf("Exam prep"));
  assert.equal(names[names.length - 1], "Lab");
});

test("labels follow time until due", () => {
  const label = (h) => urgencyForAssignment(item(1, 1, h == null ? null : hours(h), 10, "x"), now);
  assert.equal(label(-3), "critical");
  assert.equal(label(20), "critical");
  assert.equal(label(48), "high");
  assert.equal(label(100), "medium");
  assert.equal(label(200), "low");
  assert.equal(label(null), "low");
});

test("done work, stale overdue work and empty placeholders are left out", () => {
  const queue = buildPriorityQueue({
    assignments: [
      item(1, 1, hours(5), 10, "Done"),
      item(2, 1, hours(-100), 10, "Long gone"),
      item(3, 1, null, 0, "Checkpoint"),
      item(4, 1, hours(8), 10, "Open"),
    ],
    completed: (id) => id === 1,
    now,
  });
  assert.deepEqual(queue.map((entry) => entry.assignment.name), ["Open"]);
});

test("summary names the top assignments and handles an empty queue", () => {
  const queue = buildPriorityQueue({ assignments, completed: () => false, now });
  const summary = describePriorityQueue(queue);
  assert.match(summary, /^Right now, finish Reading \(Course 3\), then Quiz \(Course 1\), then /);
  assert.equal(describePriorityQueue([]), "No unfinished assignments right now.");
});
