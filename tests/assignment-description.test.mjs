import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const edge = readFileSync("supabase/functions/canvas/index.ts", "utf8");
const client = readFileSync("src/lib/canvas.functions.ts", "utf8");
const assignments = readFileSync("src/routes/_authenticated/assignments.tsx", "utf8");
const course = readFileSync("src/routes/_authenticated/courses.$courseId.tsx", "utf8");
const link = readFileSync("src/components/assignment-description-link.tsx", "utf8");

test("assignment descriptions stay behind the authenticated Canvas proxy", () => {
  assert.match(edge, /description: a\.description \?\? null/);
  assert.match(client, /description\?: string \| null/);
});

test("descriptions open on the class page, and every list links there", () => {
  // The class page renders the description and honours ?assignment=<id>.
  assert.match(course, /htmlToText\(assignment\.description/);
  assert.match(course, /searchText\(search\.assignment\)/);
  // The link goes to the assignment's class page (the old Assignments panel is only a fallback).
  assert.match(link, /to="\/courses\/\$courseId"/);
  assert.match(link, /See description/);
  // Assignment rows link out instead of expanding the text inline.
  assert.match(assignments, /<AssignmentDescriptionLink assignmentId=\{a\.id\}/);
  assert.doesNotMatch(assignments, /htmlToText\(a\.description\)/);
});
