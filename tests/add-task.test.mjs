import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { customToAssignmentItem, NO_CLASS_ID } from "../src/lib/assignment-sources.ts";
import { classColor } from "../src/lib/class-color.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("To-Do's Add asks first whether it's for a class", () => {
  const todo = read("src/routes/_authenticated/focus.tsx");
  assert.match(todo, /<AddTaskButton courseOptions=\{courseOptions\} onAdd=\{custom\.add\} \/>/);
  const dialog = read("src/components/add-task-dialog.tsx");
  assert.match(dialog, /"Is this for a class\?"/);
  assert.match(dialog, /title="For a class"/);
  assert.match(dialog, /title="Not for a class"/);
  // For a class: the Assignments form, class picker included.
  assert.match(dialog, /<AddAssignmentForm\s+courseOptions=\{courseOptions\}/);
  // Not for a class: the same list, with no class.
  assert.match(dialog, /<AddAssignmentForm\s+courseId=\{NO_CLASS_ID\}/);
  // Assignments uses the same form.
  assert.match(read("src/routes/_authenticated/assignments.tsx"), /import \{ AddAssignmentForm \} from "@\/components\/add-assignment-form";/);
});

test("a task that isn't for a class asks only what it needs", () => {
  const form = read("src/components/add-assignment-form.tsx");
  assert.match(form, /const personal = courseId === NO_CLASS_ID;/);
  assert.match(form, /points_possible: personal \|\| Number\.isNaN\(pts\) \? null : pts,/);
  assert.match(form, /\{!personal && \(/);
  assert.match(form, /\{personal \? "Due \(optional\)" : "Due"\}/);
});

test("a task with no class reads Personal, in gray, after the classes", () => {
  assert.equal(NO_CLASS_ID, 0);
  const item = customToAssignmentItem(
    { id: -1, course_id: 0, name: "Shift at work", due_at: null, points_possible: null, notes: "", created_at: "" },
    undefined,
  );
  assert.equal(item.course_name, "Personal");
  // A class's own task still takes the class's name, and an unknown class stays blank.
  assert.equal(customToAssignmentItem({ ...item, course_id: 5, notes: "" }, { name: "Bio", course_code: "B" }).course_name, "Bio");
  assert.equal(customToAssignmentItem({ ...item, course_id: 5, notes: "" }, undefined).course_name, "");
  assert.match(classColor(0, [1, 2]), /^hsl\(220 8% /);
  assert.doesNotMatch(classColor(1, [1, 2]), /^hsl\(220 8% /);
  for (const file of [
    "src/routes/_authenticated/focus.tsx",
    "src/routes/_authenticated/assignments.tsx",
    "src/components/widgets/dashboard-widgets.tsx",
  ]) {
    assert.match(read(file), /Number\([a-z]+\.(courseId|id) === NO_CLASS_ID\) - Number\([a-z]+\.(courseId|id) === NO_CLASS_ID\)/, file);
  }
  // Its group on Assignments has no grade.
  assert.match(read("src/routes/_authenticated/assignments.tsx"), /\{g\.id !== NO_CLASS_ID && \(/);
});
