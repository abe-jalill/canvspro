import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lifecycle and frame pacing still require the iOS simulator/device.
const source = readFileSync(new URL("../ios/App/App/NativeViews.swift", import.meta.url), "utf8");
const root = source.slice(0, source.indexOf("private struct NativeLaunchVisibilityKey"));

test("login crossfade follows account identity without replaying launch on token updates", () => {
  assert.match(root, /private var userID: String\? \{ sessionStore\.session\?\.user\.id \}/);
  assert.match(root, /NativeMainTabView\(sessionStore: sessionStore\)\s+\.id\(userID\)/);
  assert.match(root, /\.animation\(reduceMotion \? nil : .*value: userID\)/);
  assert.doesNotMatch(root, /\.task\(id: userID\)|handoffPending|readyUserID/);
  assert.equal((root.match(/showingLaunch = true/g) ?? []).length, 1, "Launch is only enabled by initial state");
});

test("launch blocks input and accessibility only while the overlay is present", () => {
  assert.match(root, /\.allowsHitTesting\(!showingLaunch\)/);
  assert.match(root, /\.accessibilityHidden\(showingLaunch\)/);
  assert.match(root, /\.environment\(\\.nativeLaunchIsVisible, showingLaunch\)/);
  assert.equal((root.match(/\.transition\(\.opacity\)/g) ?? []).length, 2);
  // The launch overlay fades and gently grows as it hands over to the app.
  assert.match(root, /\.transition\(\.opacity\.combined\(with: \.scale\(scale: 1\.04\)\)\)/);
});

test("launch plays for 3-5 seconds, can be skipped, and never waits on remote loading", () => {
  const duration = root.match(/Task\.sleep\(for: \.milliseconds\(reduceMotion \? (\d+) : quickReopen \? \d+ : (\d+)\)\)/);
  assert.ok(duration);
  // Reduce Motion gets a short static version; the full animation runs 3-5 s
  // while the signed-in app loads Canvas underneath.
  assert.ok(Number(duration[1]) <= 1500);
  assert.ok(Number(duration[2]) >= 3000 && Number(duration[2]) <= 5000);
  assert.match(root, /NativeLaunchView\(isSignedIn: sessionStore\.session != nil\) \{ finishLaunch\(\) \}/);
  assert.match(source, /\.onTapGesture \{ onSkip\(\) \}/);
  assert.equal((root.match(/Task\.sleep/g) ?? []).length, 1);
  assert.match(root, /guard !Task\.isCancelled/);
  assert.doesNotMatch(root, /await .*load\(|NativeStartupReadyKey/);
  assert.match(root, /withAnimation\(reduceMotion \? nil/);
});

test("section selection and assignment search do not animate whole page containers", () => {
  const more = readFileSync(new URL("../ios/App/App/NativeMoreViews.swift", import.meta.url), "utf8");
  const picker = more.slice(more.indexOf("struct NativeSectionPicker"), more.indexOf("struct NativeCalendarHub"));
  assert.doesNotMatch(picker, /withAnimation/);
  // The picker draws the website's outlined page tabs.
  assert.match(picker, /NativePageTabs\(selection: \$selection/);
  const design = readFileSync(new URL("../ios/App/App/NativeDesign.swift", import.meta.url), "utf8");
  const segmented = design.slice(design.indexOf("struct CPSegmented"), design.indexOf("// MARK: - Screen modifiers"));
  assert.doesNotMatch(segmented, /withAnimation/);
  assert.match(segmented, /matchedGeometryEffect/);
  assert.match(segmented, /reduceMotion \? nil/);
  assert.doesNotMatch(source + more, /\.cpStateChange\(section\)/);
  assert.doesNotMatch(source, /value: assignments.map\(\\.id\)/);
  assert.equal((source.match(/\.tabBarMinimizeBehavior/g) ?? []).length, 1);
});
