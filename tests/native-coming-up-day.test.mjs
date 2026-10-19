import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Coming Up on iPhone: one row of choices (Catch up, This week, each day, Next
// 4 weeks) with exactly one picked, like the website.
const more = readFileSync(new URL("../ios/App/App/NativeMoreViews.swift", import.meta.url), "utf8");
const focus = more.slice(more.indexOf("struct FocusView: View"), more.indexOf("// MARK: List", more.indexOf("struct FocusView: View")));

test("a day shows that day only; otherwise the picked range", () => {
  assert.match(focus, /guard let pickedDay else \{ return NativeParity\.isInFocusWindow\(item, window: range\) \}/);
  assert.match(focus, /Calendar\.current\.isDate\(\$0, inSameDayAs: pickedDay\)/);
  assert.match(focus, /allItems\.filter \{ inRange\(\$0\) && \$0\.isVisible\(in: store, showCompleted: showCompleted\) \}/);
});

test("one row, one choice: no range chips competing with the days", () => {
  assert.doesNotMatch(focus, /rangeChips|weekStrip/);
  assert.match(focus, /if !isSearching \{ choiceRow \}/);
  for (const title of ["Catch up", "This week", "Next 4 weeks"]) assert.ok(focus.includes(`title: "${title}"`), title);
  // Picking a range clears the day; a range only looks picked when no day is.
  assert.match(focus, /Button \{ window = value; selectedDay = nil \}/);
  assert.match(focus, /let isSelected = pickedDay == nil && range == value/);
  // Old links land on a visible choice: 24 hours opens Today.
  assert.match(focus, /selectedDay \?\? \(window == "1" \? Calendar\.current\.startOfDay\(for: Date\(\)\) : nil\)/);
});
