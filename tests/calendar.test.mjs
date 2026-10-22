import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  dayKey,
  defaultEventTimes,
  occursOn,
  readEvents,
  repeatLabel,
  suggestedPlanTime,
} from "../src/lib/calendar-events.ts";
import { entriesForDay, entryTimeLabel } from "../src/lib/calendar-agenda.ts";
import { findClassTimes } from "../src/lib/syllabus-times.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const local = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

test("your events: once, or weekly on chosen days until a date", () => {
  const [once, weekly] = readEvents([
    { id: "a", title: "Dentist", date: "2026-10-22", start: 600, end: 660, repeat: [], until: null, location: "", notes: "" },
    { id: "b", title: "Study group", date: "2026-10-20", start: 900, end: 960, repeat: [2, 4], until: "2026-11-05", location: "Library", notes: "" },
    { id: "bad", title: "No date" },
  ]);
  assert.equal(readEvents([{ id: "x", title: "t", date: "2026-02-30" }]).length, 0);
  assert.equal(occursOn(once, local(2026, 10, 22)), true);
  assert.equal(occursOn(once, local(2026, 10, 29)), false);
  assert.equal(occursOn(weekly, local(2026, 10, 22)), true); // Thursday
  assert.equal(occursOn(weekly, local(2026, 10, 21)), false); // Wednesday
  assert.equal(occursOn(weekly, local(2026, 11, 10)), false); // after "until"
  assert.equal(repeatLabel([2, 4]), "Every Tue, Thu");
  assert.equal(repeatLabel([1, 2, 3, 4, 5]), "Weekdays");
  // An end before the start is dropped rather than shown backwards.
  assert.equal(readEvents([{ id: "c", title: "t", date: "2026-10-22", start: 600, end: 500 }])[0].end, null);
});

test("planned work lands at a sensible time, never at night or in the past", () => {
  const now = local(2026, 10, 22, 9).getTime();
  const at = (iso) => new Date(iso);
  // Due Friday 11:59 PM: Friday at 4 PM.
  let t = at(suggestedPlanTime(local(2026, 10, 23, 23, 59).toISOString(), 60, now));
  assert.equal(dayKey(t), "2026-10-23");
  assert.equal(t.getHours(), 16);
  // Due Friday 9 AM: the evening before, not 6:30 in the morning.
  t = at(suggestedPlanTime(local(2026, 10, 23, 9).toISOString(), 90, now));
  assert.equal(dayKey(t), "2026-10-22");
  assert.equal(t.getHours(), 18);
  // Due at 5 PM with an hour of work: done by then.
  t = at(suggestedPlanTime(local(2026, 10, 24, 17).toISOString(), 60, now));
  assert.ok(t.getTime() + 60 * 60_000 <= local(2026, 10, 24, 17).getTime());
  // Late at night with nothing due soon: tomorrow afternoon.
  const late = local(2026, 10, 22, 23, 10).getTime();
  t = at(suggestedPlanTime(null, 60, late));
  assert.equal(dayKey(t), "2026-10-23");
  assert.equal(t.getHours(), 16);
  // A new event: the next whole hour, for an hour, in the daytime.
  assert.deepEqual(defaultEventTimes(local(2026, 10, 22, 14, 20)), { date: "2026-10-22", start: 15 * 60, end: 16 * 60 });
  assert.equal(defaultEventTimes(local(2026, 10, 22, 22, 30)).start, 9 * 60);
});

test("a day reads in time order: all-day first, classes, events, due work", () => {
  const day = local(2026, 10, 22); // Thursday
  const entries = entriesForDay(day, {
    classes: [
      { id: "1", title: "Psychology", days: ["T", "R"], startMinutes: 660, endMinutes: 735, location: "Room 204", courseId: 2 },
      { id: "2", title: "Calculus", days: ["M", "W", "F"], startMinutes: 780, endMinutes: 830, location: "", courseId: 5 },
    ],
    events: [{ id: "e", title: "Study group", date: "2026-10-20", start: 900, end: 960, repeat: [4], until: null, location: "Library", notes: "" }],
    picks: [{ assignmentId: -5, title: "Call the dentist", context: "Personal", at: local(2026, 10, 22, 16).toISOString(), dueAt: null }],
    due: [{ id: 9, name: "Reading", due_at: local(2026, 10, 22, 23, 59).toISOString(), course_id: 2, course_name: "Psych", course_code: "PSY" }],
    canvas: [{ id: 3, title: "No school", start_at: local(2026, 10, 22).toISOString(), end_at: local(2026, 10, 23).toISOString() }],
    courseName: (a) => a.course_name,
  });
  assert.deepEqual(entries.map((e) => e.title), ["No school", "Psychology", "Study group", "Call the dentist", "Reading"]);
  assert.equal(entryTimeLabel(entries[0]), "All day");
  assert.match(entryTimeLabel(entries[1]), /^11:00\sAM – 12:15\sPM$/);
  // Upcoming leaves the everyday classes out.
  assert.equal(entriesForDay(day, { classes: [{ id: "1", title: "P", days: ["R"], startMinutes: 600, endMinutes: 650, location: "", courseId: null }], events: [], picks: [], due: [], canvas: [], courseName: () => "" }, { classes: false }).length, 0);
});

test("class times come out of the syllabus; office hours and exams don't", () => {
  assert.deepEqual(findClassTimes("<p><strong>Lecture:</strong> MWF 9:00–9:50 AM, Science Hall 101</p>"), [
    { days: ["M", "W", "F"], startMinutes: 540, endMinutes: 590, location: "", kind: "Lecture" },
  ]);
  assert.deepEqual(findClassTimes("<p>Class meetings: Tuesdays and Thursdays, 2:30 to 3:45 pm in Room 204</p>"), [
    { days: ["T", "R"], startMinutes: 870, endMinutes: 945, location: "Room 204", kind: "Lecture" },
  ]);
  assert.deepEqual(findClassTimes("<tr><td>TTh</td><td>11:00-12:15 PM</td><td>Location: ENG 120</td></tr>")[0].startMinutes, 660);
  assert.equal(findClassTimes("<p>Lab: W 3:00-5:50 PM, Room B12</p>")[0].kind, "Lab");
  assert.deepEqual(findClassTimes("<p>Schedule: T/R 8:00-9:15</p>")[0].days, ["T", "R"]);
  for (const text of [
    "<p>Office hours: Mon 1-3 pm</p>",
    "<p>Final Exam: Monday, Dec 14, 10:30 AM - 12:30 PM</p>",
    "<p>Read chapters 1-2 by Tuesday.</p>",
    "<p>Week 3 (Sep 8-12): Topic</p>",
  ]) {
    assert.deepEqual(findClassTimes(text), [], text);
  }
});

test("the syllabus is read once per class, and what it finds is editable", () => {
  const hook = read("src/hooks/use-syllabus-class-times.ts");
  assert.match(hook, /export const SYLLABUS_SCAN_KEY = "syllabus-scan";/);
  // Classes with times already entered are left alone.
  assert.match(hook, /next\[String\(course\.id\)\] = "had";/);
  // Nothing found: read again only if the syllabus changes.
  assert.match(hook, /next\[String\(course\.id\)\] = `none:\$\{syllabusHash\(course\.syllabus_body\)\}`;/);
  // A lab keeps its own name so editing never merges it into the lecture.
  assert.match(hook, /title: meeting\.kind === "Lecture" \? name : `\$\{name\} \$\{meeting\.kind\}`,/);
  assert.match(hook, /action: \{ label: "Review", onClick: \(\) => void navigate\(\{ to: "\/class-schedule" \}\) \}/);
  assert.match(read("src/routes/_authenticated/route.tsx"), /useSyllabusClassTimes\(startupReady\);/);
  assert.match(read("src/lib/user-class-schedule.ts"), /canvas_course_id: r\.canvasCourseId,/);
});

test("Calendar adds events; To-Do's task can also go on the calendar", () => {
  const page = read("src/routes/_authenticated/schedule.tsx");
  assert.match(page, /Add event/);
  assert.match(page, /<CalendarEventDialog/);
  assert.match(page, /entriesForDay\(day, sources, \{ classes: false \}\)/);
  const form = read("src/components/add-assignment-form.tsx");
  assert.match(form, /Also put it on my calendar/);
  assert.match(form, /!personal && onCalendar \? new Date\(planValue\)\.toISOString\(\) : undefined/);
  assert.match(form, /calendarOption && !personal && \(/);
  const dialog = read("src/components/add-task-dialog.tsx");
  assert.match(dialog, /if \(calendarAt && input\.course_id !== NO_CLASS_ID\)\s+picks\.add\(/);
  // Events never go on To-Do.
  assert.doesNotMatch(read("src/routes/_authenticated/focus.tsx"), /calendar-events/);
  // "Add to calendar" picks a sensible time instead of always noon.
  assert.match(read("src/lib/calendar-picks.ts"), /const when = at \?\? suggestedPlanTime\(a\.due_at, defaultEstimateMinutes\(a\)\);/);
});

test("swipe the week to change it; the new week slides in from that side", () => {
  const page = read("src/routes/_authenticated/schedule.tsx");
  assert.match(page, /if \(Math\.abs\(dx\) > 50 && Math\.abs\(dx\) > Math\.abs\(dy\) \* 1\.5\) changeWeek\(dx < 0 \? 1 : -1\);/);
  assert.match(page, /weekDirection > 0\s+\? "motion-safe:slide-in-from-right-8"\s+: "motion-safe:slide-in-from-left-8"/);
  assert.match(page, /touch-pan-y/);
});
