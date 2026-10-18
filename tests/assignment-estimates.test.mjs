import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEstimateMinutes, formatEstimateMinutes } from "../src/lib/assignment-estimates.ts";
import { createOptimisticWrites } from "../src/lib/optimistic-writes.ts";

test("estimates accept whole minutes and reject empty, fractional, negative, and excessive values", () => {
  for (const value of ["1", "15", "45", " 90 ", "480"])
    assert.equal(parseEstimateMinutes(value), Number(value));
  for (const value of ["", " ", "0", "-1", "1.5", "481", "Infinity", "1e2", "twenty"])
    assert.equal(parseEstimateMinutes(value), null, value);
});

test("the shared time button keeps minute and hour estimates readable", () => {
  assert.equal(formatEstimateMinutes(15), "15 min");
  assert.equal(formatEstimateMinutes(60), "1 hr");
  assert.equal(formatEstimateMinutes(90), "1 hr 30 min");
  assert.equal(formatEstimateMinutes(480), "8 hr");
});

test("a failed edit from another occurrence restores the last saved estimate, not the optimistic value", () => {
  const writes = createOptimisticWrites();
  const first = writes.start("assignment:7", 30);
  const second = writes.start("assignment:7", 45);
  writes.commit(first, 45);
  writes.finish(first);
  assert.deepEqual(writes.rollback(second), { apply: true, value: 45 });
  writes.finish(second);
  const next = writes.start("assignment:7", 45);
  assert.deepEqual(writes.rollback(next), { apply: true, value: 45 });
  writes.finish(next);
});

test("an older failed save cannot undo a newer estimate or another assignment", () => {
  const writes = createOptimisticWrites();
  const old = writes.start("assignment:7", 30);
  const current = writes.start("assignment:7", 45);
  const other = writes.start("assignment:8", 90);
  assert.equal(writes.rollback(old).apply, false);
  assert.deepEqual(writes.rollback(other), { apply: true, value: 90 });
  writes.commit(current, 60);
  for (const ticket of [old, current, other]) writes.finish(ticket);
});
