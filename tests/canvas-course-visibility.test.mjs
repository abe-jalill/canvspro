import { test } from "node:test";
import assert from "node:assert/strict";
import { isCanvasCourseVisible } from "../supabase/functions/canvas/course-visibility.ts";

test("keeps every course returned by Canvas's active-enrollment query", () => {
  const excluded = new Set();

  assert.equal(
    isCanvasCourseVisible(
      { id: 1, workflow_state: "completed", access_restricted_by_date: true },
      excluded,
    ),
    true,
  );
});

test("only an explicit hidden-course preference globally excludes a course", () => {
  const excluded = new Set([2]);

  assert.equal(isCanvasCourseVisible({ id: 1 }, excluded), true);
  assert.equal(isCanvasCourseVisible({ id: 2 }, excluded), false);
});
