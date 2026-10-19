import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The yellow due-today outline is only on the Dashboard, like the website.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const views = read("ios/App/App/NativeViews.swift");
const more = read("ios/App/App/NativeMoreViews.swift");
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start) + start.length));

test("only Dashboard rows, the greeting and the Dashboard's workload are outlined", () => {
  for (const [source, start, end] of [
    [more, "struct GetItDoneView", "struct FocusView"],
    [more, "struct FocusView", "struct WorkloadView"],
    [views, "struct NativeAssignmentRow", "\nstruct "],
    [views, "struct CourseDetailView", "private struct CountUpGrade"],
    [views, "struct NativeStudyView", "\nstruct "],
  ]) {
    assert.doesNotMatch(between(source, start, end), /cpAssignmentDueToday/, start);
  }
  assert.match(between(views, "struct NativeDueRow", "\nstruct "), /cpAssignmentDueToday/);
  assert.match(more, /\.cpAssignmentDueToday\(item, completed: !outlineDueToday \|\| item\.isFinished\(in: store\)\)/);
  assert.match(views, /WorkloadView\(assignments: activeAssignments, store: store, features: features, outlineDueToday: true\)/);
  assert.match(views, /NativeParity\.relativeDueDay\(due\) == "Today" \{\s*RoundedRectangle\(cornerRadius: 20/);
});
