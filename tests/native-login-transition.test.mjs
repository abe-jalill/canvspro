import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Source guards only: visual timing and SwiftUI lifecycle need a simulator/device.
const source = readFileSync(new URL("../ios/App/App/NativeViews.swift", import.meta.url), "utf8");
const root = source.slice(0, source.indexOf("private struct NativeStartupReadyKey"));

test("login handoff is keyed to account identity, not refreshed tokens", () => {
  assert.match(root, /private var userID: String\? \{ sessionStore\.session\?\.user\.id \}/);
  assert.match(root, /\.task\(id: userID\)/);
  assert.match(root, /NativeMainTabView\(sessionStore: sessionStore\)\s+\.id\(userID\)/);
  assert.match(root, /guard isColdLaunch \|\| destinationUserID != nil else/);
});

test("new account content is covered and inaccessible until the handoff ends", () => {
  assert.match(root, /\.opacity\(showingLaunch \|\| handoffPending \? 0 : 1\)/);
  assert.match(root, /\.allowsHitTesting\(contentIsInteractive\)/);
  assert.match(root, /\.accessibilityHidden\(!contentIsInteractive\)/);
  assert.match(root, /\.environment\(\\.nativeLaunchIsVisible, !contentIsInteractive\)/);
});

test("readiness is account scoped, bounded, cancellable, and motion aware", () => {
  assert.match(source, /value: initialLoadFinished \? sessionStore\.session\?\.user\.id : nil/);
  assert.match(root, /readyUserID == destinationUserID/);
  assert.match(root, /0\.\.<\(isColdLaunch \? 15 : 26\)/);
  assert.match(root, /guard !Task\.isCancelled, userID == destinationUserID/);
  assert.match(root, /guard userID == destinationUserID, !showingLaunch/);
  assert.match(root, /reduceMotion \? 150 : 900/);
  assert.match(root, /reduceMotion \? 0\.15 : 0\.45/);
});
