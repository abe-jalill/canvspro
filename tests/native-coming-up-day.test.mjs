import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Coming Up on iPhone: a picked day overrides the range chips, like the website.
const more = readFileSync(new URL("../ios/App/App/NativeMoreViews.swift", import.meta.url), "utf8");
const focus = more.slice(more.indexOf("struct FocusView: View"), more.indexOf("// MARK: List", more.indexOf("struct FocusView: View")));

test("a picked day shows everything due that day, whatever the range", () => {
  assert.match(focus, /guard let selectedDay else \{ return NativeParity\.isInFocusWindow\(item, window: window\) \}/);
  assert.match(focus, /Calendar\.current\.isDate\(\$0, inSameDayAs: selectedDay\)/);
  assert.match(focus, /allItems\.filter \{ inRange\(\$0\) && \$0\.isVisible\(in: store, showCompleted: showCompleted\) \}/);
  // The day strip shows for every range, Overdue included.
  assert.match(focus, /if !isSearching \{ weekStrip \}/);
  // Choosing a range takes over again, and no range chip looks chosen while a day is.
  assert.match(focus, /Button \{ window = value; selectedDay = nil \}/);
  assert.match(focus, /selected: selectedDay == nil && window == value/);
});
