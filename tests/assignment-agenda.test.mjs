import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAgendaView } from "../src/lib/assignment-agenda.ts";

const now = new Date(2026, 9, 5, 12).getTime(); // Mon Oct 5 2026, noon local
const day = 24 * 60 * 60 * 1000;
const entry = (id, offsetDays) => ({
  assignment: {
    id,
    due_at: offsetDays == null ? null : new Date(now + offsetDays * day).toISOString(),
  },
});
const items = [
  entry("late", -2),
  entry("soon", 1),
  entry("day7", 6.5),
  entry("wk2", 10),
  entry("wk3", 17),
  entry("wk4", 25),
  entry("far", 60),
  entry("none", null),
];
const keysOf = (view) => view.sections.map((s) => `${s.key}:${s.items.map((i) => i.assignment.id).join("+")}`);

test("default view shows overdue work and two weeks, and counts what is hidden", () => {
  const view = buildAgendaView(items, now, 14, false);
  assert.deepEqual(keysOf(view), [
    "overdue:late",
    "week1:soon+day7",
    "week2:wk2",
    "undated:none",
  ]);
  assert.equal(view.hiddenWeeks34, 2);
  assert.equal(view.hiddenBeyond, 1);
});

test("expanding reveals weeks 3 and 4 but still not later work", () => {
  const view = buildAgendaView(items, now, 28, false);
  assert.deepEqual(keysOf(view), [
    "overdue:late",
    "week1:soon+day7",
    "week2:wk2",
    "weeks34:wk3+wk4",
    "undated:none",
  ]);
  assert.equal(view.hiddenWeeks34, 0);
  assert.equal(view.hiddenBeyond, 1);
});

test("searching never hides anything", () => {
  const view = buildAgendaView(items, now, 14, true);
  assert.equal(
    view.sections.flatMap((s) => s.items).length,
    items.length,
  );
  assert.equal(view.hiddenWeeks34, 0);
  assert.equal(view.hiddenBeyond, 0);
});

test("empty sections are dropped", () => {
  const view = buildAgendaView([entry("a", 2)], now, 14, false);
  assert.deepEqual(keysOf(view), ["week1:a"]);
});
