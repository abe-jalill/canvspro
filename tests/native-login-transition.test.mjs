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
  assert.equal((root.match(/\.transition\(\.opacity\)/g) ?? []).length, 3);
});

test("launch is brief, cancellable and independent of remote account loading", () => {
  const duration = root.match(/Task\.sleep\(for: \.milliseconds\(reduceMotion \? (\d+) : (\d+)\)\)/);
  assert.ok(duration);
  assert.ok(Number(duration[1]) <= 150 && Number(duration[2]) <= 1000);
  assert.equal((root.match(/Task\.sleep/g) ?? []).length, 1);
  assert.match(root, /guard !Task\.isCancelled/);
  assert.doesNotMatch(root, /await .*load\(|NativeStartupReadyKey/);
  assert.match(root, /withAnimation\(reduceMotion \? nil/);
});

test("section selection and assignment search do not animate whole page containers", () => {
  const more = readFileSync(new URL("../ios/App/App/NativeMoreViews.swift", import.meta.url), "utf8");
  const picker = more.slice(more.indexOf("struct NativeSectionPicker"), more.indexOf("struct NativeCalendarHub"));
  assert.doesNotMatch(picker, /withAnimation/);
  // The picker draws the shared segmented control, which slides its selection.
  assert.match(picker, /CPSegmented\(selection: \$selection/);
  const design = readFileSync(new URL("../ios/App/App/NativeDesign.swift", import.meta.url), "utf8");
  const segmented = design.slice(design.indexOf("struct CPSegmented"), design.indexOf("// MARK: - Screen modifiers"));
  assert.doesNotMatch(segmented, /withAnimation/);
  assert.match(segmented, /matchedGeometryEffect/);
  assert.match(segmented, /reduceMotion \? nil/);
  assert.doesNotMatch(source + more, /\.cpStateChange\(section\)/);
  assert.doesNotMatch(source, /value: assignments.map\(\\.id\)/);
  assert.equal((source.match(/\.tabBarMinimizeBehavior/g) ?? []).length, 1);
});
