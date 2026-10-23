import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { courseAliases, parseQuickAdd } from "../src/lib/quick-add.ts";
import {
  isBigWork,
  nextStep,
  readSteps,
  stepsPercent,
  suggestSteps,
} from "../src/lib/assignment-steps.ts";
import {
  impactLabel,
  isHighImpact,
  leftTodayLabel,
  pointsShare,
  rhythmLine,
  rhythmWeek,
  todayProgress,
} from "../src/lib/todo-insights.ts";

// Thursday Oct 22, 2026, 10:00 local.
const now = new Date(2026, 9, 22, 10, 0).getTime();
const courses = [
  { id: 1, names: courseAliases("Cell Biology", "BIO 201") },
  { id: 2, names: courseAliases("General Chemistry", "CHEM 110") },
  { id: 3, names: courseAliases("Calculus I", "MATH 151", "Calc") },
];
const local = (iso) => {
  const d = new Date(iso);
  return [d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];
};

test("quick add reads class, day, time and estimate out of one line", () => {
  const r = parseQuickAdd("read ch4 bio fri 30m", courses, now);
  assert.equal(r.name, "Read ch4");
  assert.equal(r.courseId, 1);
  assert.equal(r.minutes, 30);
  assert.deepEqual(local(r.dueAt), [10, 23, 23, 59]);

  const lab = parseQuickAdd("Lab report chem tomorrow 5pm 1h", courses, now);
  assert.equal(lab.name, "Lab report");
  assert.equal(lab.courseId, 2);
  assert.equal(lab.minutes, 60);
  assert.deepEqual(local(lab.dueAt), [10, 23, 17, 0]);

  const calc = parseQuickAdd("problem set calc next thu at 6 2 hours", courses, now);
  assert.equal(calc.courseId, 3);
  assert.equal(calc.minutes, 120);
  assert.deepEqual(local(calc.dueAt), [10, 29, 18, 0]);
});

test("quick add without a class is personal, and a past time today means tomorrow", () => {
  const r = parseQuickAdd("call dentist 9am", courses, now);
  assert.equal(r.courseId, null);
  assert.equal(r.name, "Call dentist");
  assert.deepEqual(local(r.dueAt), [10, 23, 9, 0]);
  // No day or time: today at 11:59 PM, so it shows on today's To-Do.
  assert.deepEqual(local(parseQuickAdd("buy groceries", courses, now).dueAt), [10, 22, 23, 59]);
  assert.deepEqual(local(parseQuickAdd("essay tonight", courses, now).dueAt), [10, 22, 21, 0]);
  assert.deepEqual(local(parseQuickAdd("quiz oct 31", courses, now).dueAt), [10, 31, 23, 59]);
  assert.deepEqual(local(parseQuickAdd("quiz 10/30 due", courses, now).dueAt), [10, 30, 23, 59]);
});

test("generic course words never pick a class", () => {
  const aliases = courseAliases("Introduction to Lab Science", "SCI 100");
  assert.ok(!aliases.includes("introduction"));
  assert.ok(!aliases.includes("lab"));
});

test("steps fill progress, weighted by minutes when every step has them", () => {
  const steps = [
    { id: "a", title: "Outline", minutes: 30, done: true },
    { id: "b", title: "Draft", minutes: 90, done: false },
  ];
  assert.equal(stepsPercent(steps), 25);
  assert.equal(stepsPercent([{ ...steps[0], minutes: null }, steps[1]]), 50);
  assert.equal(nextStep(steps).title, "Draft");
  assert.equal(stepsPercent([]), 0);
  assert.deepEqual(readSteps({ 7: [{ title: "x", minutes: -1, done: 1 }], bad: "nope" }), {
    7: [{ id: "s0", title: "x", minutes: null, done: false }],
  });
});

test("suggested steps match the kind of work and share out the estimate", () => {
  const exam = suggestSteps("Midterm exam", 120);
  assert.equal(exam[0].title, "Gather notes and topics");
  assert.equal(exam.length, 4);
  assert.ok(exam.every((s) => s.minutes >= 5 && s.minutes % 5 === 0));
  assert.equal(suggestSteps("Research paper", 200)[1].title, "Outline");
  assert.ok(isBigWork(50, 30));
  assert.ok(isBigWork(10, 90));
  assert.ok(!isBigWork(10, 30));
});

test("impact is the share of a class's points, never a grade", () => {
  const all = [
    { id: 1, course_id: 5, points_possible: 100 },
    { id: 2, course_id: 5, points_possible: 300 },
    { id: 3, course_id: 6, points_possible: 10 },
    { id: 4, course_id: 0, points_possible: 10 },
  ];
  assert.equal(pointsShare(all[0], all), 0.25);
  assert.equal(pointsShare(all[3], all), null);
  assert.equal(impactLabel(0.25), "25% of class points");
  assert.equal(impactLabel(0.02), null);
  assert.ok(isHighImpact(0.1));
  assert.ok(!isHighImpact(0.09));
});

test("today's progress counts a head start", () => {
  const p = todayProgress([
    { done: true, progress: null, minutes: 30 },
    { done: false, progress: 50, minutes: 60 },
  ]);
  assert.equal(p.left, 1);
  assert.equal(p.fraction, 0.75);
  assert.equal(p.minutesLeft, 30);
  assert.equal(leftTodayLabel(2, 3), "2 left today");
  assert.equal(leftTodayLabel(0, 3), "All done today");
});

test("the weekly rhythm is Sunday–Saturday and forgiving", () => {
  const days = rhythmWeek(
    [
      new Date(2026, 9, 18, 9).toISOString(),
      new Date(2026, 9, 20, 22).toISOString(),
      new Date(2026, 9, 17, 9).toISOString(), // last week
      null,
    ],
    now,
  );
  assert.deepEqual(days, [true, false, true, false, false, false, false]);
  assert.equal(rhythmLine(days, now), "2 of 4 active days. Rest days count too.");
  assert.equal(
    rhythmLine(Array(7).fill(false), new Date(2026, 9, 18).getTime()),
    "New week, fresh start.",
  );
  assert.match(
    rhythmLine([true, true, true, true, false, false, false], now),
    /Rest is part of the plan/,
  );
});

test("To-Do wires in steps, impact, quick add, start, shortcuts and the rhythm", () => {
  const focus = readFileSync(
    new URL("../src/routes/_authenticated/focus.tsx", import.meta.url),
    "utf8",
  );
  for (const piece of [
    "quickCourses={quickCourses}",
    "<StepList",
    "<WeeklyRhythm",
    "groupByImpact",
    "data-todo-start",
    "Keyboard shortcuts",
    "Done for today",
    'role="progressbar"',
  ]) {
    assert.ok(focus.includes(piece), piece);
  }
  assert.match(focus, /to="\/study-session"[\s\S]{0,80}assignment:/);
  const study = readFileSync(
    new URL("../src/routes/_authenticated/study-session.tsx", import.meta.url),
    "utf8",
  );
  // Quick add lives under +, at the top of Add.
  const add = readFileSync(new URL("../src/components/add-task-dialog.tsx", import.meta.url), "utf8");
  assert.match(add, /<QuickAdd courses=\{quickCourses\}/);
  assert.doesNotMatch(focus, /<QuickAdd/);
  assert.match(study, /How far did you get\?[\s\S]{0,400}AssignmentProgressEditor/);
});
