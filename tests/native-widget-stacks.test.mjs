import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The iPhone dashboard's Home Screen-style widget stacks. Swift is compiled by Codemagic.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const design = read("ios/App/App/NativeDesign.swift");
const views = read("ios/App/App/NativeViews.swift");
const stack = design.slice(design.indexOf("struct CPWidgetStack"));
const dashboard = views.slice(views.indexOf("private struct NativeDashboardView"), views.indexOf("struct NativeCourseGroup"));

test("the greeting and what's new stay on top, the rest is in stacks below", () => {
  const body = dashboard.slice(dashboard.indexOf("var body: some View"));
  const order = ["hero", 'widgetIDs.contains("digest") { digestWidget', "dashboardHeader", "dashboardBlock(block)"].map((part) => body.indexOf(part));
  assert.ok(order.every((at) => at > 0), String(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(dashboard, /\("now", \["upcoming", "focus", "calendar"\]\)/);
  assert.match(dashboard, /\("classes", \["classes", "announcements", "heatmap"\]\)/);
  // A stack of one is just the card.
  assert.match(dashboard, /if block\.widgets\.count > 1 \{\s*CPWidgetStack/);
});

test("stacks page vertically one card at a time with the box-turn transition", () => {
  assert.match(stack, /ScrollView\(\.vertical\)/);
  assert.match(stack, /\.scrollTargetBehavior\(\.viewAligned\(limitBehavior: \.always\)\)/);
  assert.match(stack, /\.scrollTransition\(\.interactive, axis: \.vertical\)/);
  assert.match(stack, /anchor: phase\.value < 0 \? \.bottom : \.top/);
  assert.match(stack, /axis: \(x: 1, y: 0, z: 0\)/);
  assert.match(stack, /\.clipShape\(RoundedRectangle\(cornerRadius: CPLayout\.cardRadius, style: \.continuous\)\)/);
  // Reduce Motion keeps paging but drops the turn and the shrink.
  assert.match(stack, /\.degrees\(still \? 0 : -phase\.value \* tilt\)/);
});

test("dots show while it moves and fade after, and every card is the stack's height", () => {
  assert.match(stack, /onScrollPhaseChange \{ _, phase in onPhase\(phase != \.idle\) \}/);
  assert.match(stack, /Task\.sleep\(for: \.seconds\(1\.4\)\)/);
  assert.match(stack, /\.environment\(\\\.cpFillsStack, true\)/);
  assert.match(design, /maxHeight: fillsStack \? \.infinity : nil/);
  assert.match(design, /content\.environment\(\\\.cpFillsStack, false\)/);
});

test("it opens on what matters now and lists the cards with VoiceOver", () => {
  assert.match(stack, /_current = State\(initialValue:/);
  assert.match(stack, /if voiceOver \{\s*VStack\(spacing: 16\)/);
  assert.match(dashboard, /start\.timeIntervalSince\(now\) <= 3 \* 3600/);
  assert.match(dashboard, /if !newAnnouncements\.isEmpty && block\.widgets\.contains\("announcements"\)/);
});
