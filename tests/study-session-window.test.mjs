import assert from "node:assert/strict";
import test from "node:test";
import { isInStudySessionWindow, studySessionEnd } from "../src/lib/study-session-window.ts";

function localDate(year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour).getTime();
}

test("Study Session shows through the end of day 10 by default", () => {
  const now = localDate(2026, 10, 4);
  assert.equal(isInStudySessionWindow(new Date(2026, 9, 14, 23, 59, 59).toISOString(), now, false), true);
  assert.equal(isInStudySessionWindow(new Date(2026, 9, 15, 0, 0).toISOString(), now, false), false);
  assert.equal(isInStudySessionWindow(null, now, false), false);
});

test("search reaches the same date next month, including its final minute", () => {
  const now = localDate(2026, 10, 4);
  assert.equal(isInStudySessionWindow(new Date(2026, 10, 4, 23, 59, 59).toISOString(), now, true), true);
  assert.equal(isInStudySessionWindow(new Date(2026, 10, 5, 0).toISOString(), now, true), false);
  assert.equal(isInStudySessionWindow(null, now, true), true);
});

test("a month from January 31 clamps to February's last day", () => {
  const now = localDate(2027, 1, 31);
  assert.equal(studySessionEnd(now, true), new Date(2027, 1, 28, 23, 59, 59, 999).getTime());
  assert.equal(studySessionEnd(localDate(2028, 1, 31), true), new Date(2028, 1, 29, 23, 59, 59, 999).getTime());
});

test("invalid dates never appear", () => {
  assert.equal(isInStudySessionWindow("not a date", localDate(2026, 10, 4), true), false);
});
