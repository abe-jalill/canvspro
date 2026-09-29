import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/routes/_authenticated/courses.$courseId.tsx", "utf8");

test("course detail uses the three focused sections without an All Sections tab", () => {
  assert.doesNotMatch(source, /All Sections/);
  assert.match(source, /useState<"upcoming" \| "graded" \| "announcements">/);
  assert.match(source, />\s*Upcoming\s*</);
  assert.match(source, />\s*Graded\s*</);
  assert.match(source, />\s*Announcements\s*</);
});

test("course grade keeps the ease-out count-up animation", () => {
  assert.match(source, /function AnimatedGradeCounter/);
  assert.match(source, /1 - Math\.pow\(1 - progress, 4\)/);
  assert.match(source, /<AnimatedGradeCounter score=\{score\}/);
});
