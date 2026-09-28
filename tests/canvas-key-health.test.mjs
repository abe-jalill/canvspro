import assert from "node:assert/strict";
import test from "node:test";
import {
  canvasBundleHasSuccessfulSection,
  isCanvasKeyWarningCurrent,
} from "../src/lib/canvas-key-status.ts";

test("a newer Canvas success suppresses a stale invalid-key warning", () => {
  const warningAt = "2026-09-28T12:00:00.000Z";
  assert.equal(isCanvasKeyWarningCurrent(warningAt, Date.parse(warningAt) + 1), false);
});

test("a newer invalid-key warning remains visible", () => {
  const warningAt = "2026-09-28T12:00:00.000Z";
  assert.equal(isCanvasKeyWarningCurrent(warningAt, Date.parse(warningAt) - 1), true);
});

test("legacy warnings without timestamps clear after a confirmed success", () => {
  assert.equal(isCanvasKeyWarningCurrent(undefined, 1), false);
  assert.equal(isCanvasKeyWarningCurrent(undefined, 0), true);
});

test("an empty but successful Canvas section still proves the key works", () => {
  assert.equal(canvasBundleHasSuccessfulSection(undefined), true);
  assert.equal(
    canvasBundleHasSuccessfulSection({
      courses: "Canvas API 401",
      assignments: "Canvas API 401",
      announcements: "Canvas API 401",
      calendar: "Canvas API 401",
    }),
    false,
  );
  assert.equal(
    canvasBundleHasSuccessfulSection({ courses: "Canvas API 403" }),
    true,
  );
});
