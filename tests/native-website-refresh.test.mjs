import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const views = read("NativeViews");
const more = read("NativeMoreViews");
const parity = read("NativeFeatures");
const design = read("NativeDesign");

// Source guards for website main at 783443c; run Codemagic for Swift compilation.
test("Today includes the website Focus date strip and grouping hierarchy", () => {
  for (const label of ["Coming up", "By day", "By class", "Show finished", "Nothing due this day."]) {
    assert.ok(more.includes(`"${label}"`), label);
  }
  assert.ok(more.includes("Calendar.current.date(byAdding: .day"));
  assert.ok(views.includes("requestedAssignment: $studyRequest"));
  assert.ok(views.includes("if !sessionStarted || sessionFinished"));
  assert.ok(views.includes('section == "Get It Done"'));
  assert.ok(!more.includes(".sheet(item: $studyAssignment)"));
});

test("agenda uses local-day two/four-week horizons and search can reveal later work", () => {
  for (const days of [7, 14, 28]) assert.ok(views.includes(`NativeParity.endOfUpcomingDay(${days}, from: now)`));
  assert.ok(views.includes("private var horizon = 14"));
  assert.ok(views.includes('horizon == 28 || !search.isEmpty'));
  assert.ok(views.includes('"Following week"'));
  assert.ok(views.includes('"Show weeks 3 and 4"'));
  assert.ok(views.includes('if dueAt == nil && (pointsPossible ?? 0) <= 0 { return showCompleted }'));
  assert.ok(parity.includes('value: -3'));
  assert.ok(parity.includes('endOfUpcomingDay(28, from: now)'));
});

test("priority surfaces share the same scorer and quiet labels", () => {
  assert.ok(views.includes("NativeParity.rankedAssignments(remaining.filter { $0.dueDate != nil }"));
  assert.ok(more.includes("NativeParity.rankedAssignments(visibleAssignments"));
  assert.ok(!views.includes("NativeParity.priority("));
  for (const label of ["Do first", "Soon", "This week", "Later"]) assert.ok(parity.includes(`"${label}"`));
  assert.ok(parity.includes("return a == b ? AssignmentItem.dueSort(left, right) : a > b"));
});

test("native study session supports the new Pomodoro choices and persisted phase", () => {
  for (const label of ["Pomodoro", "Short break", "Long break", "Skip break"]) assert.ok(views.includes(`"${label}"`));
  assert.ok(views.includes('case "deep": return NativePomodoroPlan(focus: 50, shortBreak: 10, longBreak: 30, rounds: 4)'));
  assert.ok(views.includes("let blockEndsAt: Date?"));
  assert.ok(views.includes("private func tick()"));
});

test("Canvas-submitted assignments can be marked unfinished and synced", () => {
  const core = read("NativeCore");
  assert.ok(core.includes('value["reopenedAt"]'));
  assert.ok(core.includes('api.completionState(token: token'));
  assert.ok(views.includes('guard let reopened = store.reopenedAt[id]'));
  assert.ok(!views.includes('.disabled(assignment.isCanvasFinished)'));
});

test("description links preserve class context and expand the target", () => {
  assert.ok(views.includes("highlightAssignment: assignment"));
  assert.ok(views.includes("_expandedDescriptions = State(initialValue: [item.id])"));
  assert.ok(views.includes("proxy.scrollTo(id, anchor: .center)"));
  assert.ok(views.includes(".id(assignment.id)"));
  assert.ok(views.includes('NavigationLink("Assignment details")'));
});

test("dashboard suppresses empty classes without concealing urgent work", () => {
  // Only classes with something due get a row; the rest become one quiet line.
  assert.ok(views.includes("return items.isEmpty ? nil : NativeCourseGroup(course: course, items: items)"));
  assert.ok(views.includes('class has" : "classes have") nothing due.'));
  assert.ok(views.includes('stillUrgent > 0 ? "Nothing new since your last visit."'));
  assert.ok(views.includes("WorkloadView(assignments: activeAssignments, store: store, features: features)"));
  assert.ok(design.includes("adaptive(dark: .hsl(hue, 0.45, 0.64), light: .hsl(hue, 0.50, 0.38))"));
  assert.ok(more.includes("store.displayName(courseID: course.id, fallback: course.name)"));
});
