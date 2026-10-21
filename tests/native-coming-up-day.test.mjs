import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// To-Do on iPhone: a tab of its own with one list. Catch-up work first, then
// each day of the next four weeks (or each class). Nothing to pick.
const more = readFileSync(new URL("../ios/App/App/NativeMoreViews.swift", import.meta.url), "utf8");
const views = readFileSync(new URL("../ios/App/App/NativeViews.swift", import.meta.url), "utf8");
const focus = more.slice(more.indexOf("struct FocusView: View"), more.indexOf("struct NativeTitledGroup"));

test("To-Do is its own tab, first of the picks, and a page in More when it isn't one", () => {
  assert.match(views, /case \.todo: return "To-Do"/);
  assert.match(views, /static let defaultMiddle: \[NativeTab\] = \[\.todo, \.study, \.grades\]/);
  assert.match(views, /case \.todo:\s+NavigationStack \{ FocusView\(store: contentStore, features: featureStore\) \}/);
  assert.match(more, /case \.todo: FocusView\(store: store, features: features, inMore: true\)/);
  // Opened from More it keeps the bar, so its back button is there.
  assert.match(focus, /\.toolbar\(inMore \? \.visible : \.hidden, for: \.navigationBar\)/);
  // Today is only the dashboard now: no section tabs.
  assert.doesNotMatch(views + more, /NativeTodayTabs|todaySection|CanvasProLastTodayPage/);
});

test("one list: catch up first, then each day; no ranges or days to pick", () => {
  assert.doesNotMatch(focus, /choiceRow|rangeTile|dayTile|selectedDay|pickedDay|"Next 4 weeks"|CPSegmented/);
  assert.match(focus, /\(!query\.isEmpty \|\| NativeParity\.isInFocusWindow\(item, window: "all"\)\) && item\.isVisible\(in: store\)/);
  // Your own tasks with no due date are listed too (last), not lost.
  assert.match(focus, /if item\.dueDate == nil \{\s+listed = item\.id < 0 && !item\.showsDone\(in: store\)/);
  assert.match(focus, /due < Date\(\) \? \.distantPast : calendar\.startOfDay\(for: due\)/);
  assert.match(focus, /date == \.distantPast \? "Catch up"/);
  // Grouping is a small menu beside the week's line.
  assert.match(focus, /Picker\("Group by", selection: \$grouping\)/);
  assert.match(focus, /CPLinkLabel\(text: grouping, symbol: "chevron\.down"\)/);
});

test("To-Do rows sit in one card per day, the name and one short line", () => {
  assert.match(focus, /Text\("To-Do"\)\.cpFont\(28, \.semibold\)/);
  assert.match(focus, /return "\\\(week\.count\) this week · \\\(Self\.duration\(/);
  for (const symbol of ["magnifyingglass", "checkmark.circle", "plus"]) {
    assert.ok(focus.includes(`CPIconButtonLabel(symbol: "${symbol}")`), symbol);
  }
  assert.match(focus, /if showSearch \|\| isSearching \{ searchField/);
  const rows = focus.slice(focus.indexOf("private func section("));
  assert.match(rows, /if item\.id != group\.items\.last\?\.id \{ CPRowDivider\(leading: 32\) \}/);
  assert.match(rows, /\.cpSurface\(radius: 20\)/);
  assert.doesNotMatch(rows, /NativeEstimateEditor|countdown\.label|CPInsetRow|lineLimit\(1\)/);
  assert.match(rows, /\.nativeAssignmentSwipe\(item, store: store\)/);
});
