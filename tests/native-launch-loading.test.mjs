import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Opening the app shows a loading phase, never counts worked out from half the
// data (saved coursework from last time, before hidden classes and ticks arrive).
const read = (name) => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const core = read("NativeCore");
const views = read("NativeViews");
const more = read("NativeMoreViews");
const features = read("NativeFeatures");
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));

test("every screen waits for this launch's coursework and account settings", () => {
  assert.match(core, /@Published var isSyncingAtLaunch = true/);
  // Both loads finish first; a very slow connection stops waiting after 15 seconds.
  assert.match(views, /_ = await \(content, features\)\s+\/\/[^\n]*\n\s+contentStore\.isSyncingAtLaunch = false/);
  assert.match(views, /try\? await Task\.sleep\(for: \.seconds\(15\)\)\s+contentStore\.isSyncingAtLaunch = false/);
  // The sample account has nothing to wait for.
  assert.match(core, /hasLoaded = true\s+isSyncingAtLaunch = false/);
});

test("Today shows only placeholders while loading, and no counts beside a failure", () => {
  const dashboard = between(views, "private struct NativeDashboardView", "private var shouldAskForWidgets");
  assert.match(dashboard, /\} else if store\.loadFailure != nil \{\s+NativeLoadFailedCard\(store: store\)\s+\} else if store\.showsSkeleton \{[\s\S]*?NativeDashboardSkeleton\(\)\s+\} else \{\s+hero/);
  const skeleton = between(views, "private struct NativeDashboardSkeleton", "/// One day of Today's week strip.");
  assert.doesNotMatch(skeleton, /Text\(/);
  // To-Do and More keep their counts back too.
  assert.match(more, /if showsCounts \{\s+Text\(headerLine\)/);
  assert.match(more, /if store\.showsSkeleton && !\[NativeTab\.study, \.files\]\.contains\(page\) \{ return " " \}/);
});

test("widgets and reminders never get half-loaded data, and follow hidden classes", () => {
  assert.match(views, /contentStore\.lastSyncedAt != nil, !contentStore\.isSyncingAtLaunch else \{ return \}/);
  assert.match(views, /\.onChange\(of: featureStore\.hiddenCourseIDs\) \{ _, _ in rescheduleLocalReminders\(\) \}/);
});

test("a part Canvas couldn't send keeps what was there, instead of reading as nothing due", () => {
  assert.match(core, /let merged = freshBundle\.keepingWhatFailed\(from: bundle\)/);
  assert.match(core, /assignments: keptAssignments/);
  assert.match(core, /courses: failed\["courses"\] != nil \? previous\.courses : courses/);
  // A listed class whose work all vanished at once (three or more before) keeps it.
  assert.match(core, /where items\.count >= 3 && listed\.contains\(courseID\) && !fresh\.contains\(courseID\)/);
  assert.match(core, /Some Canvas data couldn't update\. Pull down to try again\./);
});

test("the account's settings are kept on the phone, and cleared at sign-out", () => {
  assert.match(features, /private struct SavedState: Codable/);
  assert.match(features, /\} else \{\s+loadSavedState\(\)\s+\}/);
  assert.ok((features.match(/persistSavedState\(\)/g) ?? []).length >= 5);
  assert.match(core, /removeObject\(forKey: NativeFeatureStore\.savedStateKey\(userID: previousUserID\)\)/);
});
