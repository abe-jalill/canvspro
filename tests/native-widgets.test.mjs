import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Home Screen widgets: To-Do and Calendar join Today, What's Due and Grades;
// Next Class is gone (classes are on the Calendar widget). All share one look.
const shared = readFileSync(new URL("../ios/App/Shared/CanvasProWidgetData.swift", import.meta.url), "utf8");
const widgets = readFileSync(new URL("../ios/App/CanvasProWidgets/CanvasProWidgets.swift", import.meta.url), "utf8");
const views = readFileSync(new URL("../ios/App/App/NativeViews.swift", import.meta.url), "utf8");
const more = readFileSync(new URL("../ios/App/App/NativeMoreViews.swift", import.meta.url), "utf8");

test("the bundle has To-Do and Calendar, and no Next Class", () => {
  assert.match(widgets, /CanvasProTodayWidget\(\)\s+CanvasProTodoWidget\(\)\s+CanvasProCalendarWidget\(\)\s+CanvasProDueSoonWidget\(\)\s+CanvasProGradesWidget\(\)/);
  assert.match(widgets, /\.configurationDisplayName\("To-Do"\)/);
  assert.match(widgets, /\.configurationDisplayName\("Calendar"\)/);
  assert.doesNotMatch(widgets + shared + views, /CanvasProNextClass/);
  assert.match(shared, /static let todoKind = "CanvasProTodo"/);
  assert.match(shared, /static let calendarKind = "CanvasProCalendar"/);
});

test("the app hands the widgets To-Do and the Calendar, worked out as on their tabs", () => {
  assert.match(shared, /var todo: \[TodoItem\]\? = nil/);
  assert.match(shared, /var agenda: \[AgendaItem\]\? = nil/);
  assert.match(views, /featureStore\.shownAssignments\(in: contentStore, includePersonalTasks: true\)/);
  assert.match(views, /done: item\.showsDone\(in: contentStore\) \|\| pending\[item\.id\] != nil/);
  assert.match(views, /let agendaSource = NativeCalendarAgenda\(store: contentStore, features: featureStore\)/);
  // The Calendar screen uses the same helper.
  assert.match(more, /private var agenda: NativeCalendarAgenda \{ NativeCalendarAgenda\(store: store, features: features\) \}/);
  assert.match(views, /todo: Array\(todo\.prefix\(40\)\),\s+agenda: Array\(agenda\.prefix\(60\)\)/);
});

test("ticking off on the To-Do widget saves like the other widgets", () => {
  assert.match(shared, /Button\(intent: CanvasProCompleteAssignment\(item\)\) \{ CanvasProCheckMark\(done: false\) \}/);
  assert.match(shared, /init\(_ item: CanvasProWidgetSnapshot\.TodoItem\) \{\s+assignmentID = item\.id\s+due = item\.due/);
  // markDone ticks it on the To-Do widget too.
  assert.match(shared, /if var todo = snapshot\.todo, let index = todo\.firstIndex\(where: \{ \$0\.id == id \}\)/);
});

test("the widgets move on as things start, end and fall due", () => {
  assert.match(widgets, /for item in snapshot\.todo \?\? \[\] where item\.due > now && item\.due < horizon/);
  assert.match(widgets, /for item in snapshot\.agenda \?\? \[\] where !item\.allDay/);
  assert.match(shared, /func remainingAgenda\(at date: Date/);
});

test("every widget shares the header, the check mark and rounded numbers", () => {
  assert.match(shared, /private struct CanvasProWidgetHeader: View/);
  assert.match(shared, /private struct CanvasProCheckMark: View/);
  for (const title of ['"To-Do"', '"What\'s Due"', '"Grades"', '"CoursePro"']) {
    assert.ok(shared.includes(`CanvasProWidgetHeader(title: ${title}`), title);
  }
  assert.match(shared, /CanvasProWidgetHeader\(title: range\.label\)/);
  assert.match(shared, /design: \.rounded/);
  // Nothing on a home-screen widget is smaller than 9.5 points.
  const sizes = [...shared.matchAll(/\.font\(\.system\(size: ([\d.]+),/g)].map((m) => Number(m[1]));
  assert.ok(sizes.every((size) => size >= 9.5), `smallest: ${Math.min(...sizes)}`);
  // A soft light from the top on every home-screen widget.
  assert.match(widgets, /LinearGradient\(colors: \[Color\.white\.opacity\(scheme == \.dark \? 0\.06 : 0\.45\), \.clear\]/);
});

test("the app's widget gallery shows the new widgets", () => {
  assert.match(views, /page == "todo"/);
  assert.match(views, /CanvasProTodoView\(snapshot: snapshot, date: now, family: \.systemLarge, interactive: false\)/);
  assert.match(views, /CanvasProCalendarView\(snapshot: snapshot, date: now, family: \.systemMedium\)/);
});
