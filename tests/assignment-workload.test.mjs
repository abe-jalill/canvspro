import { test } from "node:test";
import assert from "node:assert/strict";
import { nextUpPriority, remainingWork, selectWeightedNextUp } from "../src/lib/assignment-workload.ts";

const now = Date.parse("2026-10-05T16:00:00Z");
const assignment = (id, hours, points = 10) => ({
  id,
  name: `Assignment ${id}`,
  due_at: new Date(now + hours * 60 * 60 * 1_000).toISOString(),
  points_possible: points,
  course_id: 1,
  course_name: "Course",
  course_code: "COURSE",
  html_url: "",
});

test("remaining workload scales known points by unfinished progress", () => {
  assert.equal(remainingWork(assignment(1, 24, 100), 80), 20);
  assert.equal(remainingWork(assignment(1, 24, 50), 100), 0);
});

test("assignments without points receive a neutral workload weight", () => {
  assert.equal(remainingWork(assignment(1, 24, null), 20), 20);
});

test("balanced priority can surface substantial work over a tiny nearer quiz", () => {
  const quiz = assignment(1, 3, 2);
  const essay = assignment(2, 24, 100);
  assert.equal(selectWeightedNextUp([quiz, essay], new Map(), now)?.id, essay.id);
});

test("progress reduces priority while close deadlines still add urgency", () => {
  const major = assignment(1, 24, 100);
  assert.ok(nextUpPriority(major, 80, now) < nextUpPriority(major, 0, now));
  assert.ok(nextUpPriority(assignment(2, 2, 25), 0, now) > nextUpPriority(assignment(3, 120, 25), 0, now));
});

test("items outside the upcoming week are not selected", () => {
  assert.equal(selectWeightedNextUp([assignment(1, -1), assignment(2, 200)], new Map(), now), null);
});