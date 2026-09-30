import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = readFileSync(new URL("../ios/App/App/NativeViews.swift", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../codemagic.yaml", import.meta.url), "utf8");

test("sample data is only in Debug; Release requires a real session", () => {
  assert.match(root, /#if DEBUG\s+NativeMainTabView\(sessionStore: sessionStore, preview: true\)/);
  assert.match(root, /#else\s+if sessionStore\.session != nil \{\s+NativeMainTabView\(sessionStore: sessionStore, preview: false\)/);
  assert.match(root, /NativeAuthView\(sessionStore: sessionStore\)/);
});

test("Codemagic checks the Release SwiftUI path separately", () => {
  assert.match(workflow, /ios-release-check:/);
  assert.match(workflow, /-configuration Release/);
});
