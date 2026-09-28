import assert from "node:assert/strict";
import test from "node:test";
import {
  canvasBundleHasSuccessfulSection,
  isCanvasKeyWarningCurrent,
  isCanvasAuthenticationRejected,
  friendlyCanvasSectionError,
  shouldShowCanvasKeyWarning,
} from "../src/lib/canvas-key-status.ts";

test("a newer Canvas success suppresses a stale invalid-key warning", () => {
  const warningAt = "2026-09-28T12:00:00.000Z";
  assert.equal(isCanvasKeyWarningCurrent(warningAt, Date.parse(warningAt) + 1), false);
});

test("stored key warnings remain hidden throughout startup and network recovery", () => {
  assert.equal(shouldShowCanvasKeyWarning(true, { status: "pending", isFetching: true }), false);
  assert.equal(shouldShowCanvasKeyWarning(true, { status: "error", isFetching: false }), false);
  assert.equal(shouldShowCanvasKeyWarning(true, { status: "success", isFetching: false, data: true }), false);
  assert.equal(shouldShowCanvasKeyWarning(true, { status: "success", isFetching: true, data: false }), false);
  assert.equal(shouldShowCanvasKeyWarning(true, { status: "success", isFetching: false, data: false }), true);
  assert.equal(shouldShowCanvasKeyWarning(false, { status: "success", isFetching: false, data: false }), false);
});

test("Canvas permission, network, session and rate-limit errors never claim the key is invalid", () => {
  for (const error of [
    "Canvas API 403: Rate Limit Exceeded",
    "Canvas API 403: user not authorized for this course",
    "Canvas API 429: Too Many Requests",
    "Failed to send a request to the Edge Function",
    "NOT_AUTHENTICATED",
    "Canvas API 503: unavailable",
  ]) {
    assert.equal(isCanvasAuthenticationRejected(error), false, error);
    assert.doesNotMatch(friendlyCanvasSectionError(error), /rejected your saved key/, error);
  }
  assert.match(friendlyCanvasSectionError("Canvas API 403: Rate Limit Exceeded"), /busy/);
});

test("fresh Canvas token rejections still offer a replacement-key action", () => {
  for (const error of ["Canvas API 401: Invalid access token", "Canvas API 403: Revoked access token"]) {
    assert.equal(isCanvasAuthenticationRejected(error), true);
    assert.match(friendlyCanvasSectionError(error), /rejected your saved key/);
  }
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
