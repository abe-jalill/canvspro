import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPriorityQueue,
  buildTodayPlan,
  rankGetItDoneAssignments,
} from "../src/lib/get-it-done.ts";
import { nextUpPriority, selectWeightedNextUp } from "../src/lib/assignment-workload.ts";

const now = new Date(2026, 9, 16, 12).getTime(); // Friday noon
const day = 86_400_000;
const at = (ms) => new Date(ms).toISOString();
const item = (id, fields) => ({
  id,
  name: `A${id}`,
  course_id: 1,
  course_name: "Bio",
  points_possible: 10,
  ...fields,
});
// Due Monday, open now, few points.
const hour = 3_600_000;
// Open now, due Monday morning, few points.
const dueMonday = item(1, { due_at: at(now + 68 * hour) });
// Opens Monday morning, due Monday evening, many points: the old scorer put this first.
const opensMonday = item(2, {
  due_at: at(now + 70 * hour),
  unlock_at: at(now + 66 * hour),
  points_possible: 100,
});
const none = () => false;

test("an assignment that hasn't opened never outranks open work", () => {
  const ranked = rankGetItDoneAssignments({
    assignments: [opensMonday, dueMonday],
    completed: none,
    now,
  });
  assert.deepEqual(
    ranked.map((r) => r.assignment.id),
    [1, 2],
  );
  const queue = buildPriorityQueue({ assignments: [opensMonday, dueMonday], completed: none, now });
  assert.deepEqual(
    queue.map((r) => r.assignment.id),
    [1, 2],
  );
  const plan = buildTodayPlan({ assignments: [opensMonday, dueMonday], completed: none, now });
  assert.equal(plan[0].assignment.id, 1);
});

test("closed work is ordered by when it opens", () => {
  const later = item(3, {
    due_at: at(now + 2 * day),
    unlock_at: at(now + 2 * day - 3600_000),
    points_possible: 100,
  });
  const sooner = item(4, { due_at: at(now + 5 * day), unlock_at: at(now + day) });
  const ranked = rankGetItDoneAssignments({
    assignments: [later, sooner, dueMonday],
    completed: none,
    now,
  });
  assert.deepEqual(
    ranked.map((r) => r.assignment.id),
    [1, 4, 3],
  );
});

test("once it opens, it ranks normally again", () => {
  const opened = { ...opensMonday, unlock_at: at(now - day), due_at: at(now + day) };
  const ranked = rankGetItDoneAssignments({
    assignments: [dueMonday, opened],
    completed: none,
    now,
  });
  assert.equal(ranked[0].assignment.id, 2);
});

test("closed work is never 'next up' on the dashboard", () => {
  assert.equal(nextUpPriority(opensMonday, 0, now), Number.NEGATIVE_INFINITY);
  assert.equal(selectWeightedNextUp([opensMonday, dueMonday], new Map(), now).id, 1);
  assert.equal(selectWeightedNextUp([opensMonday], new Map(), now), null);
});
