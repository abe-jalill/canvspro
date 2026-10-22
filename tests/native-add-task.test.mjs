import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// To-Do's + asks first whether it's for a class, as on the website. A task
// that isn't for a class is saved with class id 0 and reads "Personal".
const read = (name) => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const views = read("NativeViews");
const more = read("NativeMoreViews");
const features = read("NativeFeatures");
const design = read("NativeDesign");

test("Add asks whether it's for a class, then shows the matching form", () => {
  assert.match(views, /Text\("Is this for a class\?"\)/);
  assert.match(views, /choice\("For a class", detail:/);
  assert.match(views, /choice\("Not for a class", detail: "Anything else you need to get done\."/);
  assert.match(views, /\.navigationDestination\(for: Bool\.self\) \{ forClass in\s+NativeNewTaskForm\(forClass: forClass,/);
  // Without classes it can still add a task that isn't for one.
  assert.doesNotMatch(more, /\.disabled\(visibleCourses\.isEmpty\)\s+\.accessibilityLabel\("Add/);
  assert.match(more, /\.accessibilityLabel\("Add a task"\)/);
});

test("a task that isn't for a class keeps to the essentials and has class id 0", () => {
  assert.match(views, /if forClass \{ guard let courseID else \{ return \}; classID = courseID \} else \{ classID = CustomAssignment\.noClassID \}/);
  assert.match(views, /pointsPossible: forClass && points > 0 \? points : nil, notes: forClass \? notes : ""/);
  assert.match(views, /if forClass \{ TextField\("Points"/);
  assert.match(views, /if forClass \{ TextField\("Notes"/);
  // The same "custom-assignments" list the website reads.
  assert.match(views, /features\.savePreference\("custom-assignments", features\.customAssignments \+ \[item\]\); CPHaptics\.success\(\); onDone\(\)/);
});

test("Personal: its name, a gray dot, and after the classes", () => {
  assert.match(features, /static let noClassID = 0/);
  assert.match(features, /static let noClassLabel = "Personal"/);
  assert.match(features, /let fallback = item\.courseID == CustomAssignment\.noClassID \? CustomAssignment\.noClassLabel : ""/);
  assert.match(design, /if courseID == CustomAssignment\.noClassID \{ return adaptive\(dark: \.hsl\(220, 0\.08, 0\.68\), light: \.hsl\(220, 0\.08, 0\.40\)\) \}/);
  // To-Do by class, and Today's This week.
  assert.match(more, /return classes \+ \[NativeTitledGroup\(title: CustomAssignment\.noClassLabel, items: personal, courseID: CustomAssignment\.noClassID\)\]/);
  assert.match(views, /let groups = classGroups \+ \(personal\.isEmpty \? \[\] : \[NativeCourseGroup\(course: CustomAssignment\.noClassCourse, items: personal\)\]\)/);
  assert.match(views, /\.cpNavigationTitle\(isPersonalTask \? "Task" : "Assignment"\)/);
});
