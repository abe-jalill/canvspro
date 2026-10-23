import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The tour: the website's steps without its Calendar, each sketch animated (still with Reduce
// Motion), shown on first launch and any time from Settings > Tutorial.
const read = (name) => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const views = read("NativeViews");
const more = read("NativeMoreViews");
const tour = views.slice(views.indexOf("struct NativeTutorialView: View"), views.indexOf("struct NativeOnboardingView"));

test("six steps: the website's tutorial without the Calendar", () => {
  const titles = [...tour.matchAll(/Page\(title: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(titles, [
    "Welcome to CoursePro",
    "See what's due",
    "Add your own tasks",
    "Study one thing at a time",
    "Every class at a glance",
    "Stay ahead, everywhere",
  ]);
});

test("each picture moves, and stands still with Reduce Motion", () => {
  assert.match(tour, /if reduceMotion \{\s+content\(final\)\s+\} else \{\s+PhaseAnimator\(phases, content: content, animation: animation\)/);
  for (const sketch of ["welcomeSketch", "todaySketch", "addSketch", "studySketch", "gradesSketch", "remindersSketch"]) {
    assert.match(tour, new RegExp(`private var ${sketch}: some View \\{[\\s\\S]*?looping\\(`), sketch);
  }
});

test("Settings opens it, with a close button and Back", () => {
  assert.match(more, /NativeMenuRow\(title: "Tutorial", symbol: "play\.circle"\)/);
  assert.match(more, /\.fullScreenCover\(isPresented: \$showTutorial\) \{\s+NativeTutorialView\(fromSettings: true\)/);
  assert.match(more, /try\? await features\.savePreference\("tutorial-seen", true\)/);
  assert.match(tour, /\.accessibilityLabel\("Close tutorial"\)/);
  assert.match(tour, /\.accessibilityLabel\("Back"\)/);
});
