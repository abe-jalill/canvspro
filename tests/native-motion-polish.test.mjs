import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const design = read("NativeDesign");
const views = read("NativeViews");
const more = read("NativeMoreViews");

// Source-level regression checks, not a substitute for device animation testing.
test("page surfaces cover native screens without replacing system navigation", () => {
  assert.doesNotMatch(views + more, /\.navigationTitle\(/);
  assert.match(design, /modifier\(CPPageSurface\(\)\)\.navigationTitle\(String\(title\)\)/);
  assert.match(design, /\.presentationBackground\(CPTheme.background\(scheme\)\)/);
  assert.match(views, /TabView\(selection: \$selection\)/);
  assert.match(views, /NavigationStack/);
});

test("state transitions are short and respect Reduce Motion", () => {
  assert.match(design, /content.animation\(reduceMotion \? nil : \.easeInOut\(duration: 0.2\), value: value\)/);
  for (const value of ["sessionFinished", "sessionStarted", "store.isLoading && store.bundle.courses.isEmpty", "store.isLoading && store.bundle.assignments.isEmpty"]) {
    assert.ok(views.includes(`.cpStateChange(${value})`));
  }
  assert.equal((more.match(/AsyncImage\(url: features.avatarURL, transaction: Transaction\(animation: reduceMotion \? nil/g) ?? []).length, 2);
});

test("shared backdrop avoids large blur passes and card headings wrap", () => {
  const backdrop = design.slice(design.indexOf("struct CPBackdrop"), design.indexOf("struct CPGlassCard"));
  assert.doesNotMatch(backdrop, /\.blur\(/);
  assert.match(backdrop, /RadialGradient/);
  assert.match(backdrop, /\.clipped\(\)/);
  assert.match(design, /Text\(title\).*\.fixedSize\(horizontal: false, vertical: true\)/);
});
