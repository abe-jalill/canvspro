import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  COMPLETED_RANGES,
  completedRangeStart,
  inCompletedRange,
  readCompletedRange,
} from "../src/lib/completed-range.ts";

const now = new Date(2026, 9, 23, 15, 0).getTime();

test("Completed looks back from 2 days to 2 months, a month by default", () => {
  assert.deepEqual(COMPLETED_RANGES.map((r) => r.days), [2, 7, 14, 30, 60]);
  assert.equal(readCompletedRange(undefined), 30);
  assert.equal(readCompletedRange(45), 30);
  assert.equal(readCompletedRange(2), 2);
  assert.equal(readCompletedRange(60), 60);
});

test("today counts as the first day of the range", () => {
  assert.equal(completedRangeStart(2, now), new Date(2026, 9, 22).getTime());
  assert.equal(completedRangeStart(7, now), new Date(2026, 9, 17).getTime());
  assert.ok(inCompletedRange(new Date(2026, 9, 22, 0, 1).getTime(), 2, now));
  assert.ok(!inCompletedRange(new Date(2026, 9, 21, 23, 59).getTime(), 2, now));
  assert.ok(inCompletedRange(new Date(2026, 7, 25).getTime(), 60, now));
  assert.ok(!inCompletedRange(null, 60, now));
});

test("the Completed page uses the saved range, shared with the iPhone", () => {
  const page = readFileSync(new URL("../src/routes/_authenticated/completed.tsx", import.meta.url), "utf8");
  assert.match(page, /useUserPreferenceKey<number>\(COMPLETED_RANGE_KEY, DEFAULT_COMPLETED_RANGE\)/);
  assert.match(page, /inCompletedRange\(entry\.doneAt, rangeDays, now\)/);
  assert.match(page, /Nothing finished in \{range\.long\}/);
});

test("connecting Canvas says it's easiest on a computer and syncs automatically", () => {
  const walkthrough = readFileSync(new URL("../src/components/canvas-token-walkthrough.tsx", import.meta.url), "utf8");
  assert.match(walkthrough, /Easiest on a computer\./);
  assert.match(walkthrough, /syncs automatically/);
  const gate = readFileSync(new URL("../src/components/canvas-key-gate.tsx", import.meta.url), "utf8");
  assert.match(gate, /easiest on a computer/);
});
