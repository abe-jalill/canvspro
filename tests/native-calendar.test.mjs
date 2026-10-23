import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The Calendar is website-only: the iPhone app has no Calendar tab, page,
// dashboard card or Home Screen widget. Planned work and your events still
// sync, so nothing the website saved is lost.
const read = (path) => readFileSync(new URL(`../ios/App/${path}.swift`, import.meta.url), "utf8");
const views = read("App/NativeViews");
const more = read("App/NativeMoreViews");
const features = read("App/NativeFeatures");
const widgets = read("CanvasProWidgets/CanvasProWidgets");
const shared = read("Shared/CanvasProWidgetData");

test("the iPhone app has no Calendar", () => {
  assert.doesNotMatch(views, /case calendar\b|\.calendar\b/);
  assert.doesNotMatch(more, /case \.calendar|CalendarView|NativeCalendarAgenda|NativeEventEditor/);
  assert.doesNotMatch(views, /calendarWidget|"Add to calendar"|"Remove from calendar"/);
  assert.match(views, /static let choices: \[NativeTab\] = \[\.todo, \.study, \.grades, \.files, \.announcements, \.classes\]/);
  // A website link to /schedule opens Today, not a missing page.
  assert.doesNotMatch(views, /"schedule", "calendar"/);
});

test("the dashboard and widgets drop the Calendar, keeping the website's saved layout", () => {
  assert.match(features, /Self\.defaultDashboardOrder\.filter \{ \$0 != "gpa" && \$0 != "calendar" \}/);
  assert.doesNotMatch(features, /NativeCalendarEvent|calendarEvents|hiddenCalendars/);
  assert.doesNotMatch(widgets, /CanvasProCalendar/);
  assert.doesNotMatch(shared, /AgendaItem|calendarKind|CanvasProCalendarView/);
});

test("deleting your own task still clears its spot on the website's calendar", () => {
  assert.match(features, /calendarPicks/);
  assert.match(views, /Its spot on the website's calendar goes with it\./);
});

test("the app doesn't download Canvas calendar events it has nowhere to show", () => {
  const core = readFileSync(new URL("../ios/App/App/NativeCore.swift", import.meta.url), "utf8");
  assert.match(core, /\["resource": "all", "parts": \["courses", "assignments", "announcements"\]\] as \[String: Any\]/);
  assert.doesNotMatch(core, /CalendarEventItem|let calendar: \[/);
  assert.match(core, /enum CodingKeys: String, CodingKey \{ case courses, assignments, announcements, errors \}/);
});
