import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The iPhone app has no yellow due-today outlines anywhere (the website keeps its own).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sources = ["NativeViews", "NativeMoreViews", "NativeDesign", "NativeFeatures", "NativeFiles"].map((name) =>
  read(`ios/App/App/${name}.swift`),
);

test("no yellow outline on any iPhone screen", () => {
  for (const source of sources) {
    assert.doesNotMatch(source, /cpAssignmentDueToday|outlineDueToday/);
    assert.doesNotMatch(source, /strokeBorder\(CPTheme\.warning/);
  }
});
