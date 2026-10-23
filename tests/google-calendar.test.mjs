import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  classCalendarColor,
  layoutDay,
  monthGrid,
  shortViewTitle,
  startOfWeek,
  stepAnchor,
  timeRange,
  viewDays,
  viewTitle,
} from "../src/lib/calendar-grid.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const day = new Date(2026, 9, 23); // Friday
const at = (h, m = 0) => new Date(2026, 9, 23, h, m).getTime();
const entry = (key, start, end, extra = {}) => ({ key, kind: "event", title: key, start, end, allDay: false, context: "", ...extra });

test("weeks start on Sunday; Month is Google's five- or six-week grid", () => {
  assert.equal(startOfWeek(day).getDate(), 18);
  assert.deepEqual(viewDays("week", day).map((d) => d.getDate()), [18, 19, 20, 21, 22, 23, 24]);
  const weeks = monthGrid(day);
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0].getDate(), 27); // Sep 27
  assert.equal(viewDays("day", day).length, 1);
  assert.equal(viewDays("schedule", day).length, 30);
});

test("the arrows move by a day, a week, a month or 30 days", () => {
  assert.equal(stepAnchor("day", day, 1).getDate(), 24);
  assert.equal(stepAnchor("week", day, -1).getDate(), 16);
  assert.equal(stepAnchor("month", day, 1).getMonth(), 10);
  assert.equal(stepAnchor("schedule", day, 1).getDate(), 22);
});

test("titles read like Google's", () => {
  assert.match(viewTitle("week", day), /October 2026/);
  assert.match(viewTitle("week", new Date(2026, 8, 30)), /Sep – Oct 2026/);
  assert.match(viewTitle("week", new Date(2026, 11, 31)), /Dec 2026 – Jan 2027/);
  assert.match(shortViewTitle("day", day), /Oct 23/);
  assert.equal(timeRange(at(9), at(10, 15)), "9 – 10:15am");
  assert.equal(timeRange(at(11), at(13)), "11am – 1pm");
});

test("overlapping events sit side by side; separate ones keep the full width", () => {
  const placed = layoutDay(
    [entry("a", at(9), at(10)), entry("b", at(9, 30), at(11)), entry("c", at(12), at(13))],
    day,
  );
  const by = Object.fromEntries(placed.map((p) => [p.entry.key, p]));
  assert.equal(by.a.columns, 2);
  assert.equal(by.b.column, 1);
  assert.equal(by.c.columns, 1);
  // All-day items go in the row above the hours.
  assert.equal(layoutDay([entry("d", at(0), null, { allDay: true })], day).length, 0);
});

test("something due at 11:59 PM stays inside the day", () => {
  const [late] = layoutDay([entry("due", at(23, 59), null, { kind: "due" })], day);
  assert.equal(late.end, 24 * 60);
  assert.equal(late.start, 24 * 60 - 30);
});

test("each class gets its own Google color; the page offers every calendar", () => {
  assert.notEqual(classCalendarColor(1, [1, 2]), classCalendarColor(2, [1, 2]));
  const page = read("src/routes/_authenticated/schedule.tsx");
  for (const label of ['"My events"', '"Planned work"', '"Canvas events"']) assert.ok(page.includes(label), label);
  assert.match(page, /const HIDDEN_CALENDARS_KEY = "calendar-hidden";/);
  const calendar = read("src/components/calendar/google-calendar.tsx");
  // Google's keyboard shortcuts.
  assert.match(calendar, /else if \(key === "m"\) setView\("month"\);/);
  assert.match(calendar, /if \(key === "t"\) goToday\(\);/);
});
