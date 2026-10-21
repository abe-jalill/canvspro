import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { weekProgress } from "../src/lib/week-progress.ts";
import { keepDroppedClasses } from "../src/lib/keep-dropped-classes.ts";
import { CLASS_HUES, classHue } from "../src/lib/class-color.ts";
import { formatMinutes } from "../src/lib/format-minutes.ts";

// The website's Today and To-Do match the iPhone app's.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const now = new Date(2026, 9, 21, 12).getTime(); // Wednesday noon
const at = (days, hour) => new Date(2026, 9, 21 + days, hour).toISOString();

test("the week circles count each day from today, done and in all", () => {
  const items = [
    { id: 1, due_at: at(0, 23), done: true },
    { id: 2, due_at: at(0, 23), done: false },
    { id: 3, due_at: at(2, 9), done: false },
    { id: 4, due_at: at(7, 9), done: false }, // a week out: not in the strip
    { id: 5, due_at: at(-1, 9), done: false }, // yesterday: not in the strip
    { id: 6, due_at: at(1, 9), done: false, hidden: true }, // not shown (e.g. stale)
  ];
  const days = weekProgress(
    items,
    (a) => a.done,
    (a) => !a.hidden,
    now,
  );
  assert.equal(days.length, 7);
  assert.deepEqual(
    days.map((d) => [d.total, d.done]),
    [
      [2, 1],
      [0, 0],
      [1, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  );
});

test("a class the server silently dropped keeps its work; a real change doesn't", () => {
  const item = (id, course) => ({ id, course_id: course });
  const previous = [item(1, 10), item(2, 10), item(3, 10), item(4, 20)];
  // Class 10 still listed, all three gone at once: kept.
  assert.deepEqual(
    keepDroppedClasses([item(4, 20)], previous, [10, 20]).map((a) => a.id),
    [4, 1, 2, 3],
  );
  // Class 10 no longer listed (dropped or ended): gone.
  assert.deepEqual(
    keepDroppedClasses([item(4, 20)], previous, [20]).map((a) => a.id),
    [4],
  );
  // Class 20 had only one: a teacher can delete one assignment.
  assert.deepEqual(
    keepDroppedClasses([item(1, 10), item(2, 10), item(3, 10)], previous, [10, 20]).map(
      (a) => a.id,
    ),
    [1, 2, 3],
  );
  assert.deepEqual(
    keepDroppedClasses([item(9, 30)], undefined, [30]).map((a) => a.id),
    [9],
  );
});

test("class colors are steady and calm: never yellow, never the catch-up rose", () => {
  for (const hue of CLASS_HUES) {
    assert.ok(hue < 40 || hue > 75, `${hue} is yellow`);
    assert.ok(hue > 20 && hue < 330, `${hue} is rose`);
  }
  assert.equal(classHue(20, [10, 20, 30]), CLASS_HUES[1]);
  assert.equal(classHue(20, [10, 20, 30]), classHue(20, [10, 20, 30]));
  assert.equal(formatMinutes(45), "45 min");
  assert.equal(formatMinutes(90), "1 hr 30 min");
  assert.equal(formatMinutes(240), "4 hr");
});

test("To-Do is its own page in the sidebar, and Get It Done is Today's Next up", () => {
  assert.match(
    read("src/components/app-sidebar.tsx"),
    /\{ title: "To-Do", to: "\/focus" as const, icon: ListTodo \}/,
  );
  assert.match(
    read("src/routes/_authenticated/get-it-done.tsx"),
    /throw redirect\(\{ to: "\/dashboard", replace: true \}\)/,
  );
  for (const file of [
    "src/routes/_authenticated/dashboard.tsx",
    "src/routes/_authenticated/focus.tsx",
    "src/lib/page-tab-sets.ts",
  ]) {
    assert.doesNotMatch(read(file), /TODAY_TABS/, file);
  }
});

test("Today: greeting, one line, the week, a lit Next up with Start, catch-up only when needed", () => {
  const hero = read("src/components/dashboard-hero.tsx");
  // No stat tiles and no wordy messages.
  assert.doesNotMatch(hero, /Next 24 hours|"Overdue"|past-due item|Open focus view/);
  assert.match(hero, /\$\{week\} this week/);
  assert.match(hero, /<WeekCircles days=\{days\} \/>/);
  assert.match(hero, /\{overdue > 0 && \(/);
  assert.match(hero, /\{overdue\} to catch up/);
  assert.match(hero, /to="\/study-session"\s+search=\{\{ assignment: assignment\.id \}\}/);
  // Placeholders until everything has loaded.
  assert.match(hero, /if \(loading\) return <DashboardHeroSkeleton \/>;/);
  // The Pomodoro shows only while a session runs.
  assert.match(
    read("src/components/dashboard-pomodoro.tsx"),
    /if \(!ready \|\| !session\) return null;/,
  );
});

test("the dashboard below: news only when posted, Customize underneath, widget icons", () => {
  const digest = read("src/components/digest-card.tsx");
  assert.match(
    digest,
    /if \(newAnnouncements\.length \+ gradeChanges\.length === 0\) return null;/,
  );
  assert.doesNotMatch(digest, /All caught up|Plan it|get-it-done/);
  const dashboard = read("src/routes/_authenticated/dashboard.tsx");
  assert.doesNotMatch(dashboard, /Your dashboard/);
  assert.match(dashboard, /"Customize dashboard"/);
  assert.match(dashboard, /\[&:has\(>div:empty\)\]:hidden/);
  assert.ok(dashboard.indexOf("</MasonryGrid>") < dashboard.indexOf("Customize dashboard"));
  assert.match(read("src/components/glass-card.tsx"), /icon\?: ReactNode;/);
  assert.match(read("src/components/widgets/dashboard-widgets.tsx"), /icon=\{<Grid3x3 \/>\}/);
});

test("To-Do: one list with the week as segments, day headers and class colors", () => {
  const page = read("src/routes/_authenticated/focus.tsx");
  assert.match(page, /<WeekSegments done=\{weekDone\} total=\{weekTotal\} \/>/);
  assert.match(page, /title: "Catch up"/);
  assert.match(
    page,
    /group\.isToday \? "text-primary" : group\.isCatchUp \? "text-rose-400" : "text-foreground"/,
  );
  assert.match(page, /color=\{classColor\(a\.course_id, courseIds\)\}/);
  // Counts only once everything has loaded; after a failure, no count and no
  // endless shimmer.
  assert.match(page, /\{loading \? \(\s+<span className="skeleton-shimmer[^"]*"[^>]*\/>\s+\) : failed \? \(/);
  // A failed refresh keeps showing what loaded before.
  assert.match(page, /const failed = assignments\.isError && !assignments\.data;/);
  assert.match(
    read("src/lib/canvas.queries.ts"),
    /getAssignmentsKeepingDropped\(client\.getQueryData<AssignmentItem\[\]>\(queryKey\)\)/,
  );
});
