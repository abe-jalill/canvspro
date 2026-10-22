import assert from "node:assert/strict";
import test from "node:test";
import { defaultTaskDue, isDueOnDay, startOfLocalDay, tasksForDay, todoWeekDays } from "../src/lib/todo-week.ts";
import { customAssignmentsForSurface, customToAssignmentItem } from "../src/lib/assignment-sources.ts";

const at = (year, month, day, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();

test("every day of a week resolves to the same Sunday–Saturday", () => {
  const expected = [18, 19, 20, 21, 22, 23, 24];
  for (let day = 18; day <= 24; day++) {
    const days = todoWeekDays(at(2026, 10, day));
    assert.deepEqual(days.map((t) => new Date(t).getDate()), expected);
    assert.deepEqual(days.map((t) => new Date(t).getDay()), [0, 1, 2, 3, 4, 5, 6]);
  }
});

test("four calendar weeks cross month and year boundaries and stop at week four", () => {
  assert.deepEqual(todoWeekDays(at(2026, 12, 30), 0).map((t) => new Date(t).getDate()), [27, 28, 29, 30, 31, 1, 2]);
  const fourth = todoWeekDays(at(2026, 12, 30), 3);
  assert.equal(fourth[0], startOfLocalDay(at(2027, 1, 17)));
  assert.equal(fourth[6], startOfLocalDay(at(2027, 1, 23)));
  assert.deepEqual(todoWeekDays(at(2026, 12, 30), 4), fourth);
  assert.deepEqual(todoWeekDays(at(2026, 12, 30), -1), todoWeekDays(at(2026, 12, 30)));
});

test("local midnights survive daylight saving transitions", () => {
  const oldTZ = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const days = todoWeekDays(at(2026, 11, 1));
    assert.equal(days[1] - days[0], 25 * 60 * 60 * 1000);
    assert.ok(days.every((t) => new Date(t).getHours() === 0));
    const spring = todoWeekDays(at(2026, 3, 8));
    assert.equal(spring[1] - spring[0], 23 * 60 * 60 * 1000);
    assert.ok(spring.every((t) => new Date(t).getHours() === 0));
  } finally {
    if (oldTZ === undefined) delete process.env.TZ;
    else process.env.TZ = oldTZ;
  }
});

test("the daily list includes earlier today, excludes other days and completed work", () => {
  const now = at(2026, 10, 21, 15);
  const item = (id, day, hour, done = false) => ({ id, due_at: new Date(at(2026, 10, day, hour)).toISOString(), done });
  const items = [item(1, 21, 8), item(2, 21, 23), item(3, 20, 23), item(4, 22, 0), item(5, 21, 9, true),
    { id: 6, due_at: null, done: false }, { id: 7, due_at: "invalid", done: false }];
  assert.deepEqual(tasksForDay(items, now, (a) => a.done).map((a) => a.id), [1, 2]);
  assert.deepEqual(tasksForDay(items, at(2026, 10, 22), (a) => a.done).map((a) => a.id), [4]);
  assert.equal(isDueOnDay(items[0], now), true);
  assert.equal(defaultTaskDue(now), "2026-10-21T23:59");
});

test("class work reaches assignment surfaces; personal tasks require an explicit opt-in", () => {
  const saved = [
    { id: -1, course_id: 10, name: "Class project", due_at: null, notes: "Bring notes", points_possible: 20 },
    { id: -2, course_id: 0, name: "Grocery run", due_at: null, notes: "", points_possible: null },
  ];
  assert.deepEqual(customAssignmentsForSurface(saved).map((a) => a.id), [-1]);
  assert.deepEqual(customAssignmentsForSurface(saved, true).map((a) => a.id), [-1, -2]);
  assert.equal(saved.length, 2, "filtering must never remove saved personal tasks");
  const assignment = customToAssignmentItem(saved[0], { name: "Biology", course_code: "BIO" });
  assert.equal(assignment.course_id, 10);
  assert.equal(assignment.description, "Bring notes");
  assert.equal(assignment.points_possible, 20);
});
