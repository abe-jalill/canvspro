import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Ease-of-use fixes: easy to find, hard to do by accident, and one name per thing.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("phones get a plain Menu button, and hidden sidebar controls take no focus", () => {
  const sidebar = read("src/components/app-sidebar.tsx");
  assert.match(sidebar, /aria-label=\{open \? "Close menu" : "Open menu"\}/);
  assert.match(sidebar, /<span>Menu<\/span>/);
  assert.match(sidebar, /inert=\{!hidden\}/);
  assert.match(sidebar, /aria-hidden=\{hidden\}\s+inert=\{hidden\}/);
  // A page's own name wins: My classes, not Calendar.
  assert.match(sidebar, /"\/class-schedule": "My classes",/);
  assert.match(sidebar, /const current =\s+PAGE_TITLES\[pathname\] \?\?/);
});

test("undo instead of gone-for-good; asks before signing out", () => {
  assert.match(read("src/routes/_authenticated/announcements.tsx"), /toast\("Announcement hidden", \{\s+action: \{ label: "Undo", onClick: \(\) => dismissed\.remove\(item\.id\) \},/);
  assert.match(read("src/components/widgets/dashboard-widgets.tsx"), /action: \{ label: "Undo", onClick: \(\) => dismissed\.remove\(a\.id\) \},/);
  assert.match(read("src/routes/_authenticated/schedule.tsx"), /onClick: \(\) => picks\.restore\(removed\)/);
  assert.match(read("src/components/app-sidebar.tsx"), /Sign out of CoursePro\?/);
  assert.doesNotMatch(read("src/hooks/use-hourly-reminder.ts"), /alert\(/);
});

test("one name per thing", () => {
  assert.match(read("src/components/add-task-dialog.tsx"), /aria-hidden="true" \/>\s+Add\s+<\/button>/);
  assert.match(read("src/routes/_authenticated/assignments.tsx"), /<Plus className="h-4 w-4 text-primary" \/> Add a task/);
  assert.match(read("src/routes/_authenticated/study-session.tsx"), /<Plus className="h-4 w-4" \/> Add a task/);
  assert.match(read("src/lib/assignment-agenda.ts"), /title: "Catch up"/);
  assert.match(read("src/components/class-schedule-view.tsx"), />My classes<\/h1>/);
  assert.doesNotMatch(read("src/routes/_authenticated/courses.$courseId.tsx"), />\s*Open\s*</);
});

test("bigger targets, and a reason when Start is greyed out", () => {
  assert.match(read("src/components/complete-toggle.tsx"), /after:absolute after:-inset-2\.5/);
  assert.match(read("src/routes/_authenticated/focus.tsx"), /after:absolute after:-inset-3/);
  assert.match(read("src/routes/_authenticated/study-session.tsx"), /Pick what to work on to start\. Just want a timer\?/);
  assert.match(read("src/components/class-schedule-view.tsx"), /Swipe sideways to see every day/);
});
