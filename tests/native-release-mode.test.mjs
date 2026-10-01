import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = readFileSync(new URL("../ios/App/App/NativeViews.swift", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../codemagic.yaml", import.meta.url), "utf8");

test("Debug and Release both require a real session", () => {
  assert.doesNotMatch(root, /#if DEBUG\s+NativeMainTabView/);
  assert.doesNotMatch(root, /preview: true/);
  assert.match(root, /if sessionStore\.session != nil \{\s+NativeMainTabView\(sessionStore: sessionStore\)/);
  assert.match(root, /NativeAuthView\(sessionStore: sessionStore\)/);
});

test("account settings and website preference keys are present in native UI", () => {
  const more = readFileSync(new URL("../ios/App/App/NativeMoreViews.swift", import.meta.url), "utf8");
  const features = readFileSync(new URL("../ios/App/App/NativeFeatures.swift", import.meta.url), "utf8");
  assert.match(more, /NotificationsView\(sessionStore: sessionStore, features: features\)/);
  assert.match(more, /ProfileView\(features: features, email:/);
  assert.match(more, /PhotosPicker\(selection: \$selectedPhoto/);
  assert.match(features, /func saveAccountDetails\(/);
  for (const key of ["theme", "color_theme", "dashboard-layout", "announcement_window_weeks", "hidden_course_ids", "custom-assignments"]) {
    assert.ok(features.includes(`"${key}"`) || more.includes(`"${key}"`), `missing ${key}`);
  }
});

test("native study state is account-scoped and payment entry points are absent", () => {
  const core = readFileSync(new URL("../ios/App/App/NativeCore.swift", import.meta.url), "utf8");
  const plist = readFileSync(new URL("../ios/App/App/Info.plist", import.meta.url), "utf8");
  assert.match(root, /CanvasProNativeStudySession\.\\\(store\.persistenceScope\)/);
  assert.match(core, /CanvasProNativeStudySession\.\\\(previousUserID\)/);
  assert.doesNotMatch(plist, /mobile\.billing/);
});

test("Codemagic checks the Release SwiftUI path separately", () => {
  assert.match(workflow, /ios-release-check:/);
  assert.match(workflow, /-configuration Release/);
});
