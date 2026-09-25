import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTodayPlan,
  filterAssignmentsForUpcomingWindow,
  rankGetItDoneAssignments,
} from "../src/lib/get-it-done.ts";

const now = Date.parse("2026-09-25T12:00:00.000Z");
const hours = (n) => new Date(now + n * 60 * 60 * 1000).toISOString();
const assignment = (id, due, name = `Assignment ${id}`, points = 10) => ({
  id,
  course_id: 1,
  course_name: "Physics",
  course_code: "PHY",
  name,
  due_at: due,
  html_url: `https://canvas.example/assignments/${id}`,
  points_possible: points,
  submission: {},
});

test("recommendation explains urgent overdue work and ignores done or skipped assignments", () => {
  const ranked = rankGetItDoneAssignments({
    assignments: [
      assignment(1, hours(48), "Later lab", 100),
      assignment(2, hours(-2), "Missing homework", 20),
      assignment(3, hours(2), "Completed quiz", 100),
      assignment(4, hours(1), "Skipped reading", 10),
    ],
    completed: (id) => id === 3,
    skipped: new Set(["4"]),
    estimates: new Map([[2, 45]]),
    now,
  });

  assert.equal(ranked[0].assignment.name, "Missing homework");
  assert.match(ranked[0].explanation, /overdue/);
  assert.deepEqual(ranked.map((item) => item.assignment.id), [2, 1]);
});

test("today plan respects manual order and keeps workload realistic", () => {
  const plan = buildTodayPlan({
    assignments: [
      assignment(1, hours(3), "Tonight", 20),
      assignment(2, hours(24), "Tomorrow", 20),
      assignment(3, hours(72), "Three days", 20),
      assignment(4, hours(96), "Later", 20),
    ],
    completed: () => false,
    manualOrder: ["3", "1", "2"],
    estimates: new Map([
      [1, 30],
      [2, 45],
      [3, 60],
      [4, 120],
    ]),
    now,
    maxMinutes: 150,
  });

  assert.deepEqual(plan.map((item) => item.assignment.id), [3, 1, 2]);
  assert.equal(plan.reduce((sum, item) => sum + item.plannedMinutes, 0), 135);
});

test("upcoming window defaults to one week and can expand to two weeks", () => {
  const assignments = [
    assignment(1, hours(-1), "Overdue"),
    assignment(2, hours(24), "Tomorrow"),
    assignment(3, hours(24 * 8), "Next week plus one"),
    assignment(4, hours(24 * 15), "Too far"),
    assignment(5, null, "No date"),
  ];

  assert.deepEqual(
    filterAssignmentsForUpcomingWindow(assignments, now, 7).map((item) => item.id),
    [2],
  );
  assert.deepEqual(
    filterAssignmentsForUpcomingWindow(assignments, now, 14).map((item) => item.id),
    [2, 3],
  );
});
