import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gradeArrivedAt, gradedAgo, newGrades } from "../src/lib/new-grades.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const now = Date.parse("2026-10-21T18:00:00Z");
const hoursAgo = (hours) => new Date(now - hours * 3_600_000).toISOString();
const item = (id, submission) => ({ id, name: `A${id}`, submission });

test("New grades lists grades from the past 24 hours, newest first", () => {
  const list = newGrades(
    [
      item(1, { score: 9, graded_at: hoursAgo(20) }),
      item(2, { score: 8, graded_at: hoursAgo(2) }),
      item(3, { score: 7, graded_at: hoursAgo(30) }),
      item(4, { grade: "A", graded_at: hoursAgo(5) }),
    ],
    now,
  );
  assert.deepEqual(
    list.map((entry) => entry.assignment.id),
    [2, 4, 1],
  );
});

test("a grade released after grading, or regraded, counts from the later time", () => {
  // Graded two days ago, posted to the student an hour ago.
  assert.equal(
    gradeArrivedAt(item(1, { score: 9, graded_at: hoursAgo(48), posted_at: hoursAgo(1) })),
    now - 3_600_000,
  );
  // Posted two days ago, regraded an hour ago.
  assert.equal(
    gradeArrivedAt(item(2, { score: 9, graded_at: hoursAgo(1), posted_at: hoursAgo(48) })),
    now - 3_600_000,
  );
});

test("no grade, excused work, or no time means it isn't new", () => {
  assert.equal(gradeArrivedAt(item(1, { graded_at: hoursAgo(1) })), null);
  assert.equal(gradeArrivedAt(item(2, { score: 0, excused: true, graded_at: hoursAgo(1) })), null);
  assert.equal(gradeArrivedAt(item(3, { score: 5 })), null);
  assert.equal(gradeArrivedAt(item(4, undefined)), null);
  // A score of zero is still a grade.
  assert.equal(gradeArrivedAt(item(5, { score: 0, graded_at: hoursAgo(1) })), now - 3_600_000);
});

test("times read as minutes, then hours", () => {
  assert.equal(gradedAgo(now - 30_000, now), "1 min ago");
  assert.equal(gradedAgo(now - 45 * 60_000, now), "45 min ago");
  assert.equal(gradedAgo(now - 3 * 3_600_000, now), "3 hr ago");
});

test("Grades has a New grades button that opens its own page with a back arrow", () => {
  const grades = read("src/routes/_authenticated/grades.tsx");
  assert.match(grades, /to="\/new-grades"/);
  assert.match(grades, /newGrades\(assignments\.data \?\? \[\], Date\.now\(\)\)\.length/);
  for (const text of ["New grades", "Past 24 hours"]) assert.ok(grades.includes(text), text);
  const page = read("src/routes/_authenticated/new-grades.tsx");
  assert.match(page, /aria-label="Back"/);
  assert.match(page, /navigate\(\{ to: "\/grades" \}\)/);
  assert.match(page, /search=\{\{ assignment: String\(a\.id\) \}\}/);
  assert.match(page, /No new grades\./);
  assert.match(read("src/routes/_authenticated/route.tsx"), /"\/new-grades"/);
  assert.match(read("src/lib/canvas.functions.ts"), /posted_at\?: string \| null;/);
  // The review account has one recent grade to show.
  assert.match(
    read("src/lib/demo-mode.ts"),
    /graded_at: id === newestGraded \? gradedRecently : due/,
  );
});
