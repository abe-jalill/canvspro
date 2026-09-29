import { test } from "node:test";
import assert from "node:assert/strict";
import { nextCanvasPagePath } from "../supabase/functions/canvas/pagination.ts";

test("reads the next Canvas page from a standard Link header", () => {
  const link = [
    '<https://school.instructure.com/api/v1/courses/42/assignments?page=1&per_page=100>; rel="current"',
    '<https://school.instructure.com/api/v1/courses/42/assignments?page=2&per_page=100>; rel="next"',
    '<https://school.instructure.com/api/v1/courses/42/assignments?page=4&per_page=100>; rel="last"',
  ].join(",");

  assert.equal(
    nextCanvasPagePath(link, "school.instructure.com"),
    "/courses/42/assignments?page=2&per_page=100",
  );
});

test("does not follow pagination outside the configured Canvas API", () => {
  assert.equal(
    nextCanvasPagePath(
      '<https://attacker.example/api/v1/courses?page=2>; rel="next"',
      "school.instructure.com",
    ),
    null,
  );
  assert.equal(
    nextCanvasPagePath(
      '<https://school.instructure.com/login?page=2>; rel="next"',
      "school.instructure.com",
    ),
    null,
  );
});

test("returns null when Canvas has no next page", () => {
  assert.equal(
    nextCanvasPagePath(
      '<https://school.instructure.com/api/v1/courses?page=1>; rel="current"',
      "school.instructure.com",
    ),
    null,
  );
  assert.equal(nextCanvasPagePath(null, "school.instructure.com"), null);
});
