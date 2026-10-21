import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The running study session's controls do only what they say.
const views = readFileSync(new URL("../ios/App/App/NativeViews.swift", import.meta.url), "utf8");

test("tapping the task on screen doesn't restart its timer", () => {
  assert.match(views, /private func focusTask\(_ index: Int\) \{\s+\/\/[^\n]*\n\s+guard index != currentIndex else \{ return \}/);
});

test("ending a session asks first", () => {
  assert.match(views, /Button\("End session", role: \.destructive\) \{ confirmingEnd = true \}/);
  assert.match(views, /\.confirmationDialog\("End this session\?", isPresented: \$confirmingEnd, titleVisibility: \.visible\)/);
  assert.match(views, /Button\("Keep going", role: \.cancel\) \{\}/);
});

test("Up next shows whole task and class names", () => {
  const upNext = views.slice(views.indexOf('CPCardHeader(title: "Up next"'), views.indexOf("private func controlCircle"));
  assert.doesNotMatch(upNext, /\.lineLimit\(/);
  assert.match(upNext, /store\.displayName\(courseID: item\.courseID, fallback: item\.courseName\)/);
});
