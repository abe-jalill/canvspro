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
  assert.ok((more.match(/AsyncImage\(url: (features\.avatarURL|url), transaction: Transaction\(animation: reduceMotion \? nil/g) ?? []).length >= 2);
  assert.match(more, /NativeAvatar\(url: features\.avatarURL/);
});

test("shared backdrop avoids large blur passes and card headings wrap", () => {
  const backdrop = design.slice(design.indexOf("struct CPBackdrop"), design.indexOf("struct CPGlassCard"));
  assert.doesNotMatch(backdrop, /\.blur\(/);
  assert.match(backdrop, /RadialGradient/);
  assert.match(backdrop, /\.clipped\(\)/);
  assert.match(design, /Text\(title\).*\.fixedSize\(horizontal: false, vertical: true\)/);
});

test("refined cards and selections preserve accessibility", () => {
  // Card text scales with Dynamic Type through cpFont, and surfaces are solid
  // (no translucency), with stronger borders when Increase Contrast is on.
  assert.match(design, /Text\(title\)\.cpFont\(14, \.semibold\)/);
  assert.doesNotMatch(design, /\.ultraThinMaterial|\.thinMaterial/);
  assert.match(design, /contrast == \.increased/);
  const chip = design.slice(design.indexOf("struct CPChip"), design.indexOf("struct CPIconBadge"));
  assert.match(chip, /minHeight: 44/);
  assert.match(chip, /reduceMotion \? nil/);
  assert.match(chip, /accessibilityAddTraits\(selected \? \.isSelected : \[\]\)/);
  assert.match(views, /CPProgressBar\(value: \(course\.currentScore \?\? 0\) \/ 100, color: color\)/);
  assert.match(design, /struct CPProgressBar[\s\S]*?\.accessibilityHidden\(true\)/);
});
