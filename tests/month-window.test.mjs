import { test } from "node:test";
import assert from "node:assert/strict";
import { endOfUpcomingMonth } from "../src/lib/assignment-window.ts";

const at = (y, m, d, h = 12) => new Date(y, m, d, h).getTime();
const label = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
};

test("one month ahead is the same day next month, to the end of that day", () => {
  assert.equal(label(endOfUpcomingMonth(at(2026, 9, 2))), "2026-11-2 23:59");
});

test("a short month clamps to its last day", () => {
  assert.equal(label(endOfUpcomingMonth(at(2026, 0, 31))), "2026-2-28 23:59");
  assert.equal(label(endOfUpcomingMonth(at(2028, 0, 31))), "2028-2-29 23:59");
  assert.equal(label(endOfUpcomingMonth(at(2026, 9, 31))), "2026-11-30 23:59");
});

test("rolls into the next year", () => {
  assert.equal(label(endOfUpcomingMonth(at(2026, 11, 15))), "2027-1-15 23:59");
});

test("a deadline at 11:59 PM on the last day is still inside the window", () => {
  const end = endOfUpcomingMonth(at(2026, 9, 2));
  assert.ok(new Date(2026, 10, 2, 23, 59).getTime() <= end);
  assert.ok(new Date(2026, 10, 3, 0, 1).getTime() > end);
});
