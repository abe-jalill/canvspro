import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const views = read("NativeViews");
const more = read("NativeMoreViews");
const parity = read("NativeFeatures");
const design = read("NativeDesign");

// Source guards for the website refresh at acf76ba; run Codemagic for Swift compilation.
test("Focus includes the website deadline, week strip and grouping hierarchy", () => {
  for (const label of ["Next deadline", "Left to do", "Points at stake", "Time needed", "Next 7 days", "By day", "By class", "Show finished"]) {
    assert.ok(more.includes(`"${label}"`), label);
  }
  assert.ok(more.includes("Calendar.current.date(byAdding: .day"));
  assert.ok(views.includes("requestedAssignment: $studyRequest"));
  assert.ok(views.includes("if !sessionStarted || sessionFinished"));
  assert.ok(!more.includes(".sheet(item: $studyAssignment)"));
});

test("agenda uses local-day two/four-week horizons and search can reveal later work", () => {
  for (const days of [7, 14, 28]) assert.ok(views.includes(`NativeParity.endOfUpcomingDay(${days}, from: now)`));
  assert.ok(views.includes("private var horizon = 14"));
  assert.ok(views.includes('horizon == 28 || !search.isEmpty'));
  assert.ok(views.includes('"Following week"'));
  assert.ok(views.includes('"Show weeks 3 and 4"'));
  assert.ok(views.includes('if dueAt == nil && (pointsPossible ?? 0) <= 0 { return showCompleted }'));
});

test("priority surfaces share the same scorer and quiet labels", () => {
  assert.ok(views.includes("NativeParity.rankedAssignments(remaining"));
  assert.ok(more.includes("NativeParity.rankedAssignments(visibleAssignments"));
  assert.ok(!views.includes("NativeParity.priority("));
  for (const label of ["Do first", "Soon", "This week", "Later"]) assert.ok(parity.includes(`"${label}"`));
  assert.ok(parity.includes("return a == b ? AssignmentItem.dueSort(left, right) : a > b"));
});

test("description links preserve class context and expand the target", () => {
  assert.ok(views.includes("highlightAssignment: assignment"));
  assert.ok(views.includes("_expandedDescriptions = State(initialValue: [item.id])"));
  assert.ok(views.includes("proxy.scrollTo(id, anchor: .center)"));
  assert.ok(views.includes(".id(assignment.id)"));
  assert.ok(views.includes('NavigationLink("Assignment details")'));
});

test("dashboard suppresses empty classes without concealing urgent work", () => {
  assert.ok(views.includes("ForEach(activeCourses)"));
  assert.ok(views.includes("other classes have nothing due."));
  assert.ok(views.includes('urgentCount > 0 ? "Nothing new since your last visit."'));
  assert.ok(views.includes("WorkloadView(assignments: activeAssignments)"));
  assert.ok(design.includes("return .hsl(hue, 0.42, 0.58)"));
  assert.ok(more.includes("store.displayName(courseID: course.id, fallback: course.name)"));
});
