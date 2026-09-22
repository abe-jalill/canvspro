import { test } from "node:test";
import assert from "node:assert/strict";
import { createOptimisticWrites } from "../src/lib/optimistic-writes.ts";

test("an earlier failed edit never rolls back a newer optimistic edit", () => {
  const writes = createOptimisticWrites();
  const first = writes.start("task:1", false);
  const second = writes.start("task:1", true);
  assert.equal(writes.rollback(first).apply, false);
  writes.finish(first);
  assert.deepEqual(writes.rollback(second), { apply: true, value: false });
  writes.finish(second);
});

test("rollback uses the latest successful save, not an older optimistic snapshot", () => {
  const writes = createOptimisticWrites();
  const first = writes.start("task:1", false);
  const second = writes.start("task:1", true);
  writes.commit(first, true);
  writes.finish(first);
  assert.deepEqual(writes.rollback(second), { apply: true, value: true });
  writes.finish(second);
});

test("failure of one assignment leaves another assignment untouched", () => {
  const writes = createOptimisticWrites();
  const a = writes.start("task:1", false);
  const b = writes.start("task:2", false);
  writes.commit(b, true);
  assert.deepEqual(writes.rollback(a), { apply: true, value: false });
  assert.deepEqual(writes.rollback(b), { apply: true, value: true });
});
