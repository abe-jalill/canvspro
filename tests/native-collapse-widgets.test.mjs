import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Every iPhone dashboard widget folds down to just its name from a chevron on top.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const views = read("ios/App/App/NativeViews.swift");
const design = read("ios/App/App/NativeDesign.swift");

test("each widget header carries the collapse chevron", () => {
  assert.match(design, /if let collapse \{ CPCollapseButton\(collapse: collapse\) \}/);
  assert.match(design, /collapse\.isCollapsed \? "chevron\.down" : "chevron\.up"/);
  assert.match(design, /collapse\.isCollapsed \? "Expand \\\(collapse\.title\)" : "Collapse \\\(collapse\.title\)"/);
  for (const id of ["digest", "classes", "upcoming", "focus", "announcements", "heatmap"]) {
    assert.match(views, new RegExp(`collapse: collapse\\("${id}"\\)`), id);
  }
});

test("a folded widget shows only its card title, and the choice stays on this iPhone", () => {
  assert.match(views, /if collapsedWidgets\.contains\(id\) \{\s*collapsedWidget\(id\)\.transition\(\.opacity\)\s*\} else \{\s*dashboardWidget\(id\)\.transition\(\.opacity\)/);
  assert.match(views, /CPGlassCard \{ CPCardHeader\(title: widgetTitle\(id\), collapse: collapse\(id\)\) \}/);
  assert.match(views, /id == "upcoming" \? "This week" : NativeDashboardWidgetInfo\.title\(id\)/);
  assert.match(views, /private static let key = "CanvasProCollapsedWidgets"/);
  assert.match(views, /withAnimation\(reduceMotion \? nil : \.spring\(duration: 0\.34, bounce: 0\)\) \{ collapsedWidgets = ids \}/);
});
