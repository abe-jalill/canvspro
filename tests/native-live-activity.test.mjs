import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The study timer on the lock screen and in the Dynamic Island fits a session
// of any length: "1:29:57" is never cut off.
const shared = readFileSync(new URL("../ios/App/Shared/CanvasProWidgetData.swift", import.meta.url), "utf8");
const widgets = readFileSync(new URL("../ios/App/CanvasProWidgets/CanvasProWidgets.swift", import.meta.url), "utf8");
const views = readFileSync(new URL("../ios/App/App/NativeViews.swift", import.meta.url), "utf8");

// The same sums as CanvasProActivityFormat, so the widths can be checked here.
const clock = (seconds) => {
  const value = Math.max(0, seconds);
  const pad = (n) => String(n).padStart(2, "0");
  return value >= 3600
    ? `${Math.floor(value / 3600)}:${pad(Math.floor((value % 3600) / 60))}:${pad(value % 60)}`
    : `${Math.floor(value / 60)}:${pad(value % 60)}`;
};
const width = (seconds, size) => {
  const text = clock(seconds);
  const digits = [...text].filter((c) => /\d/.test(c)).length;
  return Math.ceil(digits * size * 0.64 + (text.length - digits) * size * 0.34) + 2;
};

test("the clock gets a width made for its longest reading", () => {
  assert.match(shared, /static func clockWidth\(_ state: CanvasProStudyActivity\.ContentState, size: CGFloat\) -> CGFloat/);
  assert.match(shared, /return ceil\(digits \* size \* 0\.64 \+ colons \* size \* 0\.34\) \+ 2/);
  assert.match(shared, /\.frame\(width: done \? nil : CanvasProActivityFormat\.clockWidth\(state, size: size\), alignment: frameAlignment\)/);
  // While it runs, the longest reading is the whole block, not the 0 sent as "remaining".
  assert.match(shared, /guard state\.running else \{ return state\.remaining \}\s+return max\(state\.total,/);
});

test("the Dynamic Island pill no longer caps the clock at 52 points", () => {
  assert.doesNotMatch(widgets, /CanvasProStudyClock\([^)]*\)\.frame\(maxWidth: 52\)/);
  assert.match(widgets, /compactTrailing: \{\s+CanvasProStudyClock\(state: context\.state, size: 14, weight: \.bold, stale: context\.isStale\)\s+\}/);
  // An hour and a half needs more room than 25 minutes, and more than the old cap.
  assert.equal(clock(90 * 60 - 3), "1:29:57");
  assert.ok(width(90 * 60, 14) > 52);
  assert.ok(width(25 * 60, 14) < width(90 * 60, 14));
});

test("the lock screen keeps the clock whole beside a long title", () => {
  assert.match(shared, /CanvasProStudyClock\(state: state, size: 30, stale: stale\)\.layoutPriority\(1\)/);
});

test("the app's own timer reads the same way past an hour", () => {
  assert.match(views, /Text\(CanvasProActivityFormat\.clock\(remaining\)\)\s+\.cpFont\(40, \.light\)/);
  assert.doesNotMatch(views, /String\(format: "%02d:%02d", remaining \/ 60, remaining % 60\)/);
});

test("a Live Activity left behind says so instead of showing 0:00 or last night's list", () => {
  // The block ran out with the app closed: time's up, a check instead of the clock.
  assert.match(shared, /if stale && state\.running \{ return "TIME'S UP · OPEN COURSEPRO" \}/);
  assert.match(shared, /private var done: Bool \{ state\.finished \|\| \(stale && state\.running\) \}/);
  assert.match(widgets, /CanvasProStudyLockView\(state: context\.state, stale: context\.isStale\)/);
  // Past midnight, tonight's list is over.
  assert.match(shared, /Text\("Tonight's deadlines have passed\."\)/);
  assert.match(widgets, /CanvasProTonightLockView\(state: context\.state, stale: context\.isStale\)/);
  assert.match(widgets, /title: context\.isStale \? "Tonight's over"/);
});

test("the To-Do widget opens To-Do; Next Class and Calendar are gone", () => {
  const todo = widgets.slice(widgets.indexOf("struct CanvasProTodoEntryView"));
  assert.match(todo, /\.widgetURL\(URL\(string: "canvaspro:\/\/todo"\)\)/);
  assert.doesNotMatch(widgets + shared, /CanvasProNextClass|CanvasProCalendar|canvaspro:\/\/calendar/);
});
