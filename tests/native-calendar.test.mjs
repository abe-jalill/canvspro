import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The iPhone Calendar matches the website's: your events (the same
// "calendar-events" list), class meetings from My classes, work you planned,
// due dates and Canvas events, in time order with sensible times.
const read = (name) => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const more = read("NativeMoreViews");
const features = read("NativeFeatures");
const views = read("NativeViews");
const calendar = more.slice(more.indexOf("struct CalendarView: View"), more.indexOf("struct WorkloadView: View"));

test("events are the website's list, in its format", () => {
  assert.match(features, /case repeatDays = "repeat"/);
  assert.match(features, /case id, title, date, start, end, until, location, notes/);
  assert.match(features, /decoded\("calendar-events", as: \[NativeLossy<NativeCalendarEvent>\]\.self\)/);
  assert.match(features, /try await savePreference\("calendar-events", events\)/);
  // Once, or weekly on chosen days until a date.
  assert.match(features, /if event\.repeatDays\.isEmpty \{ return key == event\.date \}/);
  assert.match(features, /if let until = event\.until, key > until \{ return false \}/);
  assert.match(features, /return event\.repeatDays\.contains\(Calendar\.current\.component\(\.weekday, from: day\) - 1\)/);
});

test("a day shows classes, events, planned work, due dates and Canvas events in order", () => {
  assert.match(calendar, /let letters = \["U": 1, "M": 2, "T": 3, "W": 4, "R": 5, "F": 6, "S": 7\]/);
  assert.match(calendar, /for event in src\.events where NativeParity\.occurs\(event, on: day\)/);
  assert.match(calendar, /if a\.allDay != b\.allDay \{ return a\.allDay \}/);
  // Canvas's midnight-to-midnight events read "All day", not 12:00 AM.
  assert.match(calendar, /let allDay = isMidnight\(start\) && \(end\.map \{ \$0 == start \|\| isMidnight\(\$0\) \} \?\? true\)/);
  assert.match(calendar, /Text\(item\.allDay \? "All day" : item\.start\.formatted\(date: \.omitted, time: \.shortened\)\)/);
  // Upcoming leaves out the everyday classes.
  assert.match(calendar, /let items = entries\(on: day, src, classes: false\)/);
  assert.match(calendar, /CPChip\(text: "Upcoming", selected: selectedDate == nil\)/);
});

test("events are added and changed here; classes are edited in My classes", () => {
  assert.match(calendar, /Button \{ editingEvent = \.new\(selectedDate \?\? today\) \} label: \{ Image\(systemName: "plus"\) \}/);
  assert.match(calendar, /\.accessibilityLabel\("Add event"\)/);
  assert.match(calendar, /NativeEventEditor\(editing: editing, features: features\)/);
  assert.match(calendar, /NavigationLink \{ ClassScheduleView\(features: features, store: store\) \}/);
  assert.match(more, /Text\("Only you see this\. It goes on your calendar, not To-Do\."\)/);
  assert.match(more, /if !timesOK \{ Text\("It needs to end after it starts\."\)/);
});

test("planned work gets a sensible time, and a new task can go on the calendar", () => {
  assert.match(features, /static func plannedTime\(for dueAt: String\?, estimate: Int = 60, now: Date = Date\(\)\) -> String/);
  assert.match(features, /if hour < 8, let before = calendar\.date\(byAdding: \.day, value: -1, to: at\)/);
  assert.match(views, /at: NativeParity\.plannedTime\(for: assignment\.dueAt, estimate: NativeParity\.estimate\(assignment, estimates: features\.estimates\)\)/);
  assert.match(views, /Toggle\("Also put it on my calendar", isOn: \$onCalendar\)/);
  assert.match(views, /if let pick, !features\.calendarPicks\.contains\(where: \{ \$0\.assignmentID == pick\.assignmentID \}\) \{\s+try await features\.savePreference\("calendar-picks", features\.calendarPicks \+ \[pick\]\)/);
});
