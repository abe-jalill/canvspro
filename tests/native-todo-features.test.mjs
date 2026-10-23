import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// To-Do on the iPhone has what the website's has: steps for big work, what an
// assignment is worth, "N left today", quick add, Start on rows, press and
// hold, "Done for today" and an optional weekly rhythm. Same synced keys.
const read = (name) => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const views = read("NativeViews");
const more = read("NativeMoreViews");
const features = read("NativeFeatures");

test("steps are saved under the website's key and fill the assignment's progress", () => {
  assert.match(features, /struct NativeAssignmentStep: Codable, Identifiable, Hashable \{\s*var id: String\s*var title: String[\s\S]{0,80}var minutes: Int\?\s*var done: Bool/);
  assert.match(features, /decoded\("assignment-steps"/);
  assert.match(features, /savePreference\("assignment-steps", all\)\s*try await saveProgress\(steps\.isEmpty \? nil : NativeSteps\.percent\(steps\), for: assignment\)/);
  assert.match(features, /static func isBigWork\(points: Double\?, estimate: Int\) -> Bool \{ \(points \?\? 0\) >= 50 \|\| estimate >= 90 \}/);
  for (const title of ["Gather notes and topics", "Read the lab and pre-lab", "Plan what's needed", "Research and notes", "Read what's asked"]) {
    assert.ok(features.includes(`("${title}"`), title);
  }
  assert.match(more, /private struct NativeStepList: View/);
  assert.match(more, /Label\("Suggest steps", systemImage: "sparkles"\)/);
  assert.match(more, /TextField\("Add a step", text: \$draft\)/);
  assert.match(more, /Text\("Next: \\\(next\.title\) · \\\(NativeSteps\.percent\(steps\)\)% done"\)/);
});

test("rows show what they're worth, and To-Do can go by impact", () => {
  assert.match(features, /"\\\(Int\(\(share \* 100\)\.rounded\(\)\)\)% of class points"/);
  assert.match(features, /guard let share, share >= 0\.03 else \{ return nil \}/);
  assert.match(features, /value == "class" \|\| value == "impact"/);
  assert.match(more, /Text\("By impact"\)\.tag\("By impact"\)/);
  assert.match(more, /NativeTitledGroup\(title: "Most impact first", items: sorted\)/);
  assert.match(more, /NativeImpactBadge\(text: impact, high: NativeTodoInsights\.isHighImpact\(itemShare\)\)/);
});

test("today's line says what's left, with a bar that counts head starts", () => {
  assert.match(features, /return "\\\(left\) left today"/);
  assert.match(more, /NativeTodoInsights\.leftTodayLabel\(left: today\.left, total: today\.total\)/);
  assert.match(more, /CPProgressBar\(value: today\.fraction/);
  assert.match(more, /title: "Done for today\. Nice work\."/);
});

test("quick add reads the class, day, time and estimate, and previews them", () => {
  for (const piece of ['"tomorrow", "tmr", "tmrw", "tom"', 't == "tonight" && time == nil { time = (h: 21, m: 0) }', 'meridiem == nil && (1...6).contains(hour)', '"noon"', '"midnight"']) {
    assert.ok(features.includes(piece), piece);
  }
  assert.match(features, /A time already past today, with no day given, means tomorrow/);
  // It's at the top of Add (the + button), not on the To-Do page itself.
  assert.match(more, /TextField\("Read ch4 bio fri 30m", text: \$quickText\)/);
  assert.match(views, /NativeQuickAddField\(courses: courses, store: store, features: features\) \{ dismiss\(\) \}/);
  assert.doesNotMatch(more.slice(more.indexOf("struct FocusView"), more.indexOf("struct NativeQuickAddField")), /NativeQuickAddField\(/);
  assert.match(more, /courseID: parsed\.courseID \?\? CustomAssignment\.noClassID/);
  assert.match(more, /savePreference\("custom-assignments", features\.customAssignments \+ \[item\]\)/);
});

test("Start and steps are buttons on the row, and press and hold has the swipes' choices", () => {
  assert.match(more, /Image\(systemName: "play\.fill"\)[\s\S]{0,500}\.accessibilityLabel\("Start studying \\\(item\.name\)"\)/);
  assert.match(more, /\.contextMenu \{[\s\S]{0,200}"Mark done"[\s\S]{0,400}"Start studying"[\s\S]{0,300}"Steps"/);
  // Afterwards Study asks how far you got.
  assert.match(views, /Text\("How far did you get\?"\)[\s\S]{0,400}NativeProgressEditor\(assignment: item, features: features\)/);
});

test("the weekly rhythm is optional, synced and forgiving", () => {
  assert.match(features, /preferences\["weekly-rhythm"\]/);
  assert.match(features, /savePreference\("weekly-rhythm", on\)/);
  assert.match(features, /static let rhythmAim = 4/);
  assert.match(features, /"New week, fresh start\."/);
  assert.match(features, /Rest days count too\./);
  assert.match(more, /NativeWeeklyRhythm\(completedAt: Array\(store\.completedAt\.values\)\)/);
  assert.match(more, /"Hide weekly rhythm" : "Show weekly rhythm"/);
});

test("Completed (from To-Do or More) shows the past 2 days to 2 months, synced", () => {
  assert.match(features, /static let days = \[2, 7, 14, 30, 60\]/);
  assert.match(features, /static let defaultDays = 30/);
  assert.match(features, /preferences\["completed-range"\]/);
  assert.match(features, /savePreference\("completed-range", days\)/);
  assert.match(more, /Picker\("How far back to show", selection: rangeChoice\)[\s\S]{0,200}\.pickerStyle\(\.segmented\)/);
  assert.match(more, /NativeCompletedRange\.contains\(\$0\.date, days: rangeDays, now: now\)/);
  // To-Do's Completed and More's Completed are the same screen.
  assert.match(more, /case \.completed: NativeCompletedView\(store: store, features: features\)/);
  assert.match(more, /NavigationLink \{ NativeCompletedView\(store: store, features: features\) \}/);
});

test("connecting Canvas says it's easiest on a computer and syncs by itself", () => {
  assert.match(more, /struct NativeComputerTip: View/);
  assert.match(more, /Connect once at canvaspro\.app and this app syncs automatically/);
  assert.match(more, /if connectedDomain == nil \{ NativeComputerTip\(\) \}/);
});
