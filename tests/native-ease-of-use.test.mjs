import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Ease-of-use fixes: nothing destructive happens on one tap, nothing fails
// silently, and empty screens offer a next step.
const read = (name) => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const views = read("NativeViews");
const more = read("NativeMoreViews");
const design = read("NativeDesign");

test("a class switch that's on means the class is shown", () => {
  assert.match(more, /isOn: Binding\(get: \{ !hidden\.contains\(course\.id\) \}, set: \{ shown in if shown \{ hidden\.remove\(course\.id\) \} else \{ hidden\.insert\(course\.id\) \}/);
  assert.match(more, /Text\("Shown in CoursePro"\)/);
});

test("deleting asks first: classes, tasks, events, and signing out", () => {
  assert.match(more, /"Delete \\\(confirmingDelete\.map\(displayName\) \?\? "this class"\) from every day\?"/);
  assert.match(more, /features\.schedule\.removeAll \{ \$0\.id == item\.id \}\s+do \{/);
  assert.match(views, /\.confirmationDialog\("Delete \\\(assignment\.name\)\?", isPresented: \$confirmingDelete/);
  assert.match(more, /isPresented: \$confirmingDelete, titleVisibility: \.visible\) \{\s+Button\("Delete", role: \.destructive\) \{ Task \{ await delete\(existing\) \} \}/);
  assert.match(more, /\.confirmationDialog\("Sign out of CoursePro on this iPhone\?", isPresented: \$confirmingSignOut/);
  assert.match(more, /settingsLink\("Delete account", "person\.crop\.circle\.badge\.xmark"\)/);
});

test("failures are said out loud", () => {
  assert.match(more, /status = "Notifications are off for CoursePro\. Turn them on in iOS Settings to get reminders on this iPhone\."/);
  assert.match(more, /features\.errorMessage = "Your notification changes weren't saved\./);
  assert.match(views, /@State private var newID = -Int\(Date\(\)\.timeIntervalSince1970 \* 1000\)/);
  assert.match(views, /Button\(saving \? "Saving…" : "Save"\)/);
});

test("empty screens offer a next step; Calendar and Announcements show loading and errors", () => {
  assert.match(views, /var actionTitle: String\? = nil/);
  assert.match(more, /actionTitle: isSearching \? "Clear search" : "Add a task",/);
  assert.match(more, /actionTitle: "Add event", action: \{ editingEvent = \.new\(today\) \}/);
  const calendar = more.slice(more.indexOf("struct CalendarView: View"), more.indexOf("struct WorkloadView: View"));
  assert.match(calendar, /if store\.needsCanvasConnection \{\s+NativeConnectCanvasCard\(store: store\)/);
  assert.match(more, /\} else if store\.loadFailure != nil && store\.bundle\.announcements\.isEmpty \{/);
});

test("Undo waits for VoiceOver, targets are 44 pt, pills grow with text", () => {
  assert.match(views, /try\? await Task\.sleep\(for: \.seconds\(assisted \? 30 : Self\.seconds\)\)/);
  assert.match(more, /CPSwipeAction\(title: "Dismiss", symbol: "eye\.slash"\)/);
  assert.doesNotMatch(views, /frame\(width: 30, height: 40\)/);
  assert.match(design, /\.frame\(minHeight: 28\)/);
  assert.match(design, /\.frame\(minHeight: 30\)/);
  assert.match(views, /Button\("Remove from calendar", role: \.destructive\) \{ removeFromCalendar\(\) \}/);
});
