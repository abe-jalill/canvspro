import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isDueThisWeek } from "../src/lib/focus-window.ts";
import { selectNextUp } from "../src/lib/assignment-workload.ts";
import { weekProgress } from "../src/lib/week-progress.ts";
import { dayCount, describeBilling } from "../src/lib/billing.ts";
import { formatStudyClock } from "../src/lib/study-session.ts";

// Small things that were wrong, each kept right here.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Since your last visit lives in the account, so every device agrees", async () => {
  const { readDigestSeen, digestSnapshot, sameDigest } = await import("../src/lib/digest-seen.ts");
  const card = read("src/components/digest-card.tsx");
  assert.match(card, /useUserPreferenceKey<unknown>\(DIGEST_SEEN_KEY, null\)/);
  // On screen a few seconds counts as seen, and is saved for every device.
  assert.match(card, /const SEEN_AFTER_MS = 5_000;/);
  assert.match(card, /if \(document\.visibilityState === "visible"\) seen\.set\(digestSnapshot\(assignments, Date\.now\(\)\)\);/);
  // This visit still shows what was new when it began.
  assert.match(card, /const lastVisit = baseline \? Date\.parse\(baseline\.lastVisit\) : Number\.POSITIVE_INFINITY;/);
  assert.doesNotMatch(card, /useLocalNumber/);
  // The same record as the iPhone app's.
  const snap = digestSnapshot(
    [{ id: 7, due_at: null, submission: { score: 9 } }],
    Date.parse("2026-10-22T12:00:00Z"),
  );
  assert.deepEqual(readDigestSeen(JSON.parse(JSON.stringify(snap))), snap);
  assert.equal(readDigestSeen({ lastVisit: "nope" }), null);
  assert.equal(sameDigest(snap, { ...snap, lastVisit: "2026-10-23T00:00:00.000Z" }), true);
});

test("hiding a class takes effect straight away, your own tasks for it included", () => {
  const editor = read("src/components/hidden-courses-editor.tsx");
  assert.match(editor, /void setAsync\(next\)\s+\.then\(\(\) => \{\s+resetCanvasBundle\(\);\s+return queryClient\.invalidateQueries\(\{ queryKey: \["canvas"\] \}\);/);
  const custom = read("src/lib/custom-assignments.ts");
  assert.match(custom, /all\.filter\(\(item\) => !hiddenIds\.has\(item\.course_id\)\)/);
  // Saving writes the whole list, so hidden tasks are never lost.
  for (const write of ["set([...all, item])", "set(all.map(", "set(all.filter("]) {
    assert.ok(custom.includes(write), write);
  }
});

test("Restore brings back every hidden announcement in one write, and counts only those", () => {
  assert.match(read("src/lib/synced-state.ts"), /const removeMany = useCallback\(\(list: \(string \| number\)\[\]\) => \{/);
  const page = read("src/routes/_authenticated/announcements.tsx");
  assert.match(page, /onClick=\{\(\) => dismissed\.removeMany\(restorable\)\}/);
  assert.match(page, /Restore \{restorable\.length\}/);
  assert.doesNotMatch(page, /forEach\(\(item\) => dismissed\.remove/);
});

test("this week is the circles' seven days on Today's line, Next up and To-Do", () => {
  const now = new Date(2026, 9, 21, 12).getTime(); // Wednesday noon
  const due = (days, hour = 23, minute = 59) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return { id: days, name: `Due +${days}`, due_at: d.toISOString(), points_possible: 10 };
  };
  // Next Tuesday counts; next Wednesday is an eighth day the circles don't show.
  assert.equal(isDueThisWeek(due(6), now), true);
  assert.equal(isDueThisWeek(due(7), now), false);
  assert.equal(isDueThisWeek(due(0, 9, 0), now), false); // already past due
  assert.equal(selectNextUp([due(7)], now), null);
  assert.equal(selectNextUp([due(6)], now)?.id, 6);
  const days = weekProgress([due(6), due(7)], () => false, () => true, now);
  assert.equal(days.reduce((n, d) => n + d.total, 0), 1);

  const hero = read("src/components/dashboard-hero.tsx");
  assert.match(hero, /isAssignmentVisible\(assignment, completed, false, now\) && isDueThisWeek\(assignment, now\)/);
  assert.match(hero, /"Nothing else due in the next seven days\."/);
  const todo = read("src/routes/_authenticated/focus.tsx");
  assert.match(todo, /const week = allAssignments\.filter\(\(a\) => isDueThisWeek\(a, now\) && !notYetOpen\(a, now\)\);/);
  // Work Canvas hasn't opened yet says when it opens.
  assert.match(todo, /<OpensLabel unlockAt=\{a\.unlock_at\} className="mt-1" \/>/);
});

test("your own tasks: class name in Next up, opened on Assignments, picked by Start", () => {
  const hero = read("src/components/dashboard-hero.tsx");
  assert.match(hero, /customToAssignmentItem\(item, courseById\.get\(item\.course_id\)\)/);
  for (const file of ["src/components/dashboard-hero.tsx", "src/routes/_authenticated/focus.tsx"]) {
    assert.match(read(file), /isCustomAssignmentId\([a-z]+(\.id)?\)\s+\? \{ to: "\/assignments", search: \{ assignment: String\(/, file);
  }
  const study = read("src/routes/_authenticated/study-session.tsx");
  assert.match(study, /const validId = \(id: number\) => Number\.isInteger\(id\) && id !== 0;/);
  assert.match(study, /\.map\(\(id\) => allAssignments\.find\(\(item\) => item\.id === id\)\)/);
});

test("Today's timer pill moves on at zero instead of sitting at 0:00", () => {
  const pill = read("src/components/dashboard-pomodoro.tsx");
  assert.match(pill, /const next = session\.perItem \? nextItemSession\(session, now\) : null;/);
  assert.match(pill, /setSession\(null\);\s+toast\.success\("Study session complete"\);/);
  assert.match(pill, /\{formatStudyClock\(remaining\)\}/);
  assert.equal(formatStudyClock(90 * 60_000 - 3_000), "1:29:57");
  assert.equal(formatStudyClock(25 * 60_000), "25:00");
  assert.equal(formatStudyClock(65_000), "1:05");
});

test("a failed refresh keeps showing what loaded; only no data at all is an error", () => {
  const checks = {
    "src/routes/_authenticated/new-grades.tsx": /assignments\.isError && !assignments\.data \?/,
    "src/routes/_authenticated/completed.tsx": /assignments\.isError && !assignments\.data \?/,
    "src/routes/_authenticated/study-session.tsx": /assignments\.error && !assignments\.data \?/,
    "src/routes/_authenticated/assignments.tsx": /const isError = queryFailed && !data;/,
    "src/routes/_authenticated/announcements.tsx": /const isError = queryFailed && !data;/,
    "src/routes/_authenticated/grades.tsx": /\(assignments\.data \? null : assignments\.error\)/,
    "src/routes/_authenticated/schedule.tsx": /\(events\.data \? null : events\.error\)/,
  };
  for (const [file, pattern] of Object.entries(checks)) assert.match(read(file), pattern, file);
  const widgets = read("src/components/widgets/dashboard-widgets.tsx");
  assert.doesNotMatch(widgets, /\{isError && <ErrorState/);
});

test("counts read right in the singular", () => {
  assert.equal(dayCount(1), "1 day");
  assert.equal(dayCount(10), "10 days");
  const now = Date.parse("2026-11-01T12:00:00Z");
  const trial = describeBilling(
    {
      access: true,
      now: new Date(now).toISOString(),
      status: "trialing",
      plan: "monthly",
      trial_ends_at: new Date(now + 86_400_000).toISOString(),
      current_period_end: null,
      cancel_at: null,
      grace_ends_at: null,
      comped: false,
    },
    now,
    "UTC",
  );
  assert.equal(trial.headline, "Free trial · 1 day left");
  assert.match(read("src/routes/_authenticated/grades.tsx"), /filteredCourses\.length === 1 \? "course" : "courses"/);
});

test("one name for the To-Do widget, and the badge recounts as deadlines pass", () => {
  assert.match(read("src/components/widgets/dashboard-widgets.tsx"), /focus: \{ label: "To-Do",/);
  const picker = read("src/components/dashboard-widget-picker.tsx");
  assert.match(picker, /focus: \{ title: "To-Do",/);
  assert.match(picker, /change it with Customize dashboard\./);
  assert.doesNotMatch(read("src/routes/_authenticated/assignments.tsx"), /Add it under "Add something/);
  const badge = read("src/hooks/use-due-today-badge.ts");
  assert.match(badge, /window\.setInterval\(\(\) => setNow\(Date\.now\(\)\), 60_000\)/);
  assert.match(badge, /if \(isAssignmentComplete\(a, done\.has\(String\(a\.id\)\)\)\) return false;/);
});

test("click-through fixes stay fixed", () => {
  const hero = read("src/components/dashboard-hero.tsx");
  // A running timer sits on the date row, never squeezing the greeting.
  assert.match(hero, /<p className="text-sm font-medium text-muted-foreground">\{date\}<\/p>\s+<DashboardPomodoro \/>/);
  const assignments = read("src/routes/_authenticated/assignments.tsx");
  assert.match(assignments, /<EmptyState message=\{q \? "No matches\." : "Nothing to do yet\."\} \/>/);
  assert.match(assignments, /\{!q && \(\s+<PriorityAssignmentsCard/);
  assert.match(assignments, /flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-0/);
  // "Due within 1 day: Lab report" in the bell and in push alike.
  assert.match(read("src/hooks/use-notification-engine.ts"), /title: `Due within \$\{w\.label\.replace\(" before", ""\)\}: \$\{a\.name\}`/);
  assert.match(read("src/lib/push-dispatch.server.ts"), /title: `Due within \$\{w\.label\.replace\(" before", ""\)\}: \$\{a\.name\}`/);
  // A Canvas event is never taken for a class's meeting time.
  const course = read("src/routes/_authenticated/courses.$courseId.tsx");
  assert.doesNotMatch(course, /calendarQueryState/);
  assert.match(course, /pastDue \? `Past due · \$\{formattedDate\}` : formattedDate/);
  // Toasts follow the theme; buzzing waits for a tap; grades are readable on light.
  assert.match(read("src/routes/__root.tsx"), /<Toaster position="top-center" richColors closeButton theme=\{theme\} \/>/);
  assert.match(read("src/lib/study-session-feedback.ts"), /if \(activation && !activation\.hasBeenActive\) return;/);
  assert.match(read("src/lib/grade-color.ts"), /var\(--grade-lightness, 58%\)/);
  // The phone header names the page or class.
  assert.match(read("src/components/app-sidebar.tsx"), /navItems\.find\(\(i\) => isItemActive\(pathname, i\.to\)\)\?\.title \?\?/);
  // Clearing the Canvas key asks first.
  assert.match(read("src/components/settings-sections.tsx"), /<AlertDialogTitle>Clear your Canvas key\?<\/AlertDialogTitle>/);
  assert.match(read("src/components/gpa-calculator.tsx"), /Add each class&rsquo;s credits in My classes to see your GPA\./);
  assert.match(read("src/lib/completed-list.ts"), /return "Past week";/);
  assert.match(read("src/routes/auth.css"), /color-scheme: dark;/);
  assert.match(read("src/components/legal-consent.tsx"), /I agree to the\{" "\}\s+<a/);
});
