import { test } from "node:test";
import assert from "node:assert/strict";
import { remainingWork, selectNextUp } from "../src/lib/assignment-workload.ts";

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
  assert.ok(Math.abs(remainingWork(assignment(1, 24, 100), 80) - 20) < 0.0001);
  assert.equal(remainingWork(assignment(1, 24, 50), 100), 0);
});

test("assignments without points receive a neutral workload weight", () => {
  assert.equal(remainingWork(assignment(1, 24, null), 20), 20);
});

test("Next up is the work due soonest, even when something later is worth more", () => {
  const quiz = assignment(1, 3, 2);
  const essay = assignment(2, 24, 100);
  assert.equal(selectNextUp([essay, quiz], now)?.id, quiz.id);
});

test("two due at the same time: the one worth more points", () => {
  const small = assignment(1, 24, 10);
  const big = assignment(2, 24, 50);
  const none = assignment(3, 24, null);
  assert.equal(selectNextUp([small, none, big], now)?.id, big.id);
});

test("items outside the upcoming week are not selected", () => {
  assert.equal(selectNextUp([assignment(1, -1), assignment(2, 200)], now), null);
});

test("the workload week line names the total and the busiest day", async () => {
  const { workloadWeekSummary } = await import("../src/lib/assignment-workload.ts");
  const mon = new Date(2026, 9, 19);
  const tue = new Date(2026, 9, 20);
  assert.equal(workloadWeekSummary([{ date: mon, count: 0 }, { date: tue, count: 0 }]), "Nothing due");
  assert.equal(workloadWeekSummary([{ date: mon, count: 1 }, { date: tue, count: 1 }]), "2 due");
  assert.match(workloadWeekSummary([{ date: mon, count: 1 }, { date: tue, count: 3 }]), /^4 due · busiest /);
});

test("the website's workload shows one week at a time, like the iPhone app", async () => {
  const { readFileSync } = await import("node:fs");
  const view = readFileSync(new URL("../src/components/workload-heatmap.tsx", import.meta.url), "utf8");
  assert.match(view, /const WEEK_NAMES = \["This week", "Next week", "Week 3", "Week 4"\]/);
  assert.match(view, /const shown = weekRows\[Math\.min\(week, weekRows\.length - 1\)\]/);
  assert.match(view, /height: count === 0 \? 4 : 10 \+ 50 \* share/);
  assert.doesNotMatch(view, /Workload — next/);
});
