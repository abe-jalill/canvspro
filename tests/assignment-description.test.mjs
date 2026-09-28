import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const edge = readFileSync("supabase/functions/canvas/index.ts", "utf8");
const client = readFileSync("src/lib/canvas.functions.ts", "utf8");
const assignments = readFileSync("src/routes/_authenticated/assignments.tsx", "utf8");
const link = readFileSync("src/components/assignment-description-link.tsx", "utf8");

test("assignment descriptions stay behind the authenticated Canvas proxy", () => {
  assert.match(edge, /description: a\.description \?\? null/);
  assert.match(client, /description\?: string \| null/);
});

test("descriptions render only on Assignments and other views deep-link there", () => {
  assert.match(assignments, /htmlToText\(selectedAssignment\.description/);
  assert.match(assignments, /htmlToText\(a\.description\)/);
  assert.match(link, /to="\/assignments"/);
  assert.match(link, /See description/);
});
