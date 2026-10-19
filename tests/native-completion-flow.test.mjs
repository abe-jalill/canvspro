import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Marking work complete on iPhone: the tick shows, the row folds away, a clear
// Undo appears on every tab, and a Completed page lists everything finished.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const core = read("ios/App/App/NativeCore.swift");
const views = read("ios/App/App/NativeViews.swift");
const more = read("ios/App/App/NativeMoreViews.swift");
const design = read("ios/App/App/NativeDesign.swift");

test("the tick shows first, then the row folds away; tapping again in that moment cancels", () => {
  assert.match(core, /@Published var completing = Set<Int>\(\)/);
  assert.match(core, /static let completionHold: Duration = \.milliseconds\(450\)/);
  assert.match(core, /undoItem = assignment\s*if !UIAccessibility\.isReduceMotionEnabled \{\s*completing\.insert\(id\)\s*try\? await Task\.sleep\(for: Self\.completionHold\)\s*guard completing\.contains\(id\) else \{ return \}/);
  assert.match(core, /if completing\.contains\(assignment\.id\) \{ cancelCompletion\(assignment\.id\); return \}/);
  assert.match(core, /withAnimation\(completionMotion\) \{\s*completing\.remove\(id\)/);
  // Rows show done during the tick, and slide out as the list closes up.
  assert.match(views, /store\.completing\.contains\(id\) \|\| isFinished\(in: store\)/);
  assert.match(design, /removal: \.opacity\.combined\(with: \.offset\(x: 28\)\)/);
  for (const source of [views, more]) assert.match(source, /\.transition\(\.cpCompletionExit\)/);
});

test("Undo is big, on every tab, and undoes before or after the save", () => {
  assert.match(views, /Text\("Marked complete"\)/);
  assert.match(views, /Label\("Undo", systemImage: "arrow\.uturn\.backward"\)/);
  assert.match(views, /Button \{ Task \{ await store\.undo\(item\) \} \}/);
  assert.match(core, /func undo\(_ assignment: AssignmentItem\) async \{[\s\S]*?if completing\.contains\(assignment\.id\) \{ cancelCompletion\(assignment\.id\); return \}\s*if assignment\.isFinished\(in: self\) \{ await toggle\(assignment\) \}/);
  assert.equal((views.match(/\.cpUndoBar\(store: contentStore\)/g) ?? []).length, 5);
  assert.doesNotMatch(views, /\.cpUndoBar\(store: store\)/);
});

test("Completed opens its own page with the back arrow, from Assignments", () => {
  assert.match(more, /NavigationLink \{ NativeCompletedView\(store: store, features: features\) \} label: \{\s*Label\("Completed", systemImage: "checkmark\.circle"\)/);
  assert.match(more, /\.toolbar\(\.hidden, for: \.tabBar\)/);
  assert.match(more, /\["Today", "Yesterday", "This week", "Earlier"\]/);
  // Ticked off here: the saved time; done in Canvas: when it was submitted.
  assert.match(core, /if let text = value\["completedAt"\] as\? String, let date = ISO8601DateFormatter\.canvasDate\(from: text\) \{ completedAt\[id\] = date \}/);
  assert.match(more, /\(marked \? store\.completedAt\[item\.id\] : nil\) \?\? submitted \?\? item\.dueDate/);
});
