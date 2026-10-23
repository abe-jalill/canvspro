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
const calendar = more.slice(more.indexOf("struct NativeCalendarAgenda"), more.indexOf("struct WorkloadView: View"));

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
  assert.match(calendar, /if entry\.allDay \{ return "All day" \}/);
});

test("Google Calendar's phone layout: Schedule, Day, 3 days, Week and Month", () => {
  assert.match(calendar, /case schedule, day, threeDays, week, month/);
  assert.match(calendar, /@AppStorage\("CanvasProCalendarMode"\) private var modeRaw = Mode\.schedule\.rawValue/);
  for (const piece of ["case .schedule: scheduleList(src, hidden: hidden)", "case .threeDays: timeGrid(days(from: anchor, count: 3), src, hidden: hidden)", "case .month: monthGrid(src, hidden: hidden)"]) {
    assert.ok(calendar.includes(piece), piece);
  }
  // Google's colors: today in a blue circle, a red line for now, a white (or dark) sheet.
  assert.match(calendar, /NativeGoogleColor\.hex\(0x0B57D0\)/);
  assert.match(calendar, /private let nowRed = NativeGoogleColor\.hex\(0xEA4335\)/);
  assert.match(calendar, /static let classPalette = \[sage, tangerine, grape, flamingo, basil, lavender, tomato, blueberry\]/);
  // Overlapping things sit side by side; due at 11:59 PM stays inside the day.
  assert.match(calendar, /if entry\.end == nil \{ start = min\(start, 24 \* 60 - pointMinutes\) \}/);
  assert.match(calendar, /while taken\.contains\(column\) \{ column \+= 1 \}/);
  // Day and Week run from 5 AM to 11 PM, as on the website.
  assert.match(calendar, /static let dayStartHour = 5/);
  assert.match(calendar, /ForEach\(Self\.dayStartHour\.\.<24, id: \\\.self\) \{ hour in/);
  // The same calendars as the website, switched off from the menu.
  assert.match(calendar, /CalendarOption\(id: "events", label: "My events"\)/);
  assert.match(features, /preferences\["calendar-hidden"\]/);
  assert.match(features, /savePreference\("calendar-hidden", next\.sorted\(\)\)/);
});

test("events are added and changed here; classes are edited in My classes", () => {
  assert.match(calendar, /Button \{ editingEvent = \.new\(mode == \.schedule \? today : anchor\) \}/);
  assert.match(calendar, /\.accessibilityLabel\("Create event"\)/);
  // A tapped empty slot starts a new event there.
  assert.match(calendar, /editingEvent = \.newAt\(calendar\.date\(byAdding: \.minute, value: minutes, to: calendar\.startOfDay\(for: day\)\) \?\? day\)/);
  assert.match(more, /\} else if case \.newAt\(let moment\) = editing \{/);
  assert.match(calendar, /NativeEventEditor\(editing: editing, features: features\)/);
  assert.match(calendar, /\.navigationDestination\(isPresented: \$showsClassTimes\) \{ ClassScheduleView\(features: features, store: store\) \}/);
  // Tapping anything opens its card, with its actions.
  assert.match(calendar, /\.sheet\(item: \$openEntry\) \{ entry in entryCard\(entry\) \}/);
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

test("swipe sideways to turn the page, like Google's", () => {
  assert.match(calendar, /\.simultaneousGesture\(pageSwipe\)/);
  assert.match(calendar, /guard abs\(dx\) > 60, abs\(dx\) > abs\(dy\) \* 1\.6 else \{ return \}\s+step\(dx < 0 \? 1 : -1\)/);
  // Placeholders never linger over loaded content.
  const design = readFileSync(new URL("../ios/App/App/NativeDesign.swift", import.meta.url), "utf8");
  assert.doesNotMatch(design, /repeatForever/);
  assert.match(design, /TimelineView\(\.animation\(minimumInterval: 1\.0 \/ 30, paused: reduceMotion\)\)/);
});

test("To-Do's weeks follow the finger and slide in from the side you swiped", () => {
  const picker = more.slice(more.indexOf("private struct NativeTodoWeekPicker"), more.indexOf("struct NativeTitledGroup"));
  assert.match(picker, /\.id\(weekOffset\)\s+\.transition\(slide\)\s+\.offset\(x: reduceMotion \? 0 : drag \* 0\.35\)/);
  assert.match(picker, /insertion: \.move\(edge: direction > 0 \? \.trailing : \.leading\)/);
  assert.match(picker, /\.accessibilityAction\(named: "Next week"\) \{ move\(1\) \}/);
});
