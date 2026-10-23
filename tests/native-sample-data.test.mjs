import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// App Review's account (app.preview@canvaspro.app) sees the same sample student
// on the website (src/lib/demo-mode.ts) and in the app (NativePreviewData).
const web = readFileSync(new URL("../src/lib/demo-mode.ts", import.meta.url), "utf8");
const core = readFileSync(new URL("../ios/App/App/NativeCore.swift", import.meta.url), "utf8");
const app = core.slice(core.indexOf("enum NativePreviewData"), core.indexOf("struct ClassNickname"));
const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const all = (source, pattern) => [...source.matchAll(pattern)].map((match) => match.slice(1));
// at(days, hour, minute = 0), the same on both sides.
const when = (days, hour, minute) => `${days}d ${hour}:${minute ?? "0"}`;

test("the app and the website show the review account the same classes", () => {
  const webCourses = all(
    section(web, "const COURSES", "type DemoAssignment"),
    /id: (\d+),\s+name: "([^"]+)",\s+course_code: "([^"]+)",\s+current_score: ([\d.]+),\s+current_grade: "([^"]+)"/g,
  );
  const appCourses = all(
    app,
    /CourseSummary\(id: (\d+), name: "([^"]+)", courseCode: "([^"]+)", currentScore: ([\d.]+), currentGrade: "([^"]+)"/g,
  );
  assert.equal(webCourses.length, 5);
  assert.deepEqual(appCourses, webCourses);
});

test("the app and the website show the review account the same assignments and grades", () => {
  const webRows = all(
    section(web, "function assignments", "function announcements"),
    /\[(\d+), (\d+), "([^"]+)", at\((-?\d+), (\d+)(?:, (\d+))?\), (\d+)(?:, (\d+))?\]/g,
  ).map(([id, course, name, days, hour, minute, points, score]) => [id, course, name, when(days, hour, minute), points, score ?? null]);
  const appRows = all(
    app,
    /Row\((\d+), (\d+), "([^"]+)", at\((-?\d+), (\d+)(?:, (\d+))?\), (\d+)(?:, graded: (\d+))?\)/g,
  ).map(([id, course, name, days, hour, minute, points, score]) => [id, course, name, when(days, hour, minute), points, score ?? null]);
  assert.equal(webRows.length, 19);
  assert.deepEqual(appRows, webRows);
});

test("the app and the website show the review account the same announcements", () => {
  const webNews = all(
    section(web, "function announcements", "function calendar"),
    /\[\s*(\d+),\s*(\d+),\s*"([^"]+)",\s*"([^"]+)",/g,
  );
  const appNews = all(app, /announcement\((\d+), (\d+), "([^"]+)", "([^"]+)"/g);
  assert.equal(webNews.length, 3);
  assert.deepEqual(appNews, webNews);
  // Calendar events are website-only, so the app has none of its own.
  assert.doesNotMatch(app, /locationName: "/);
});

test("the review account uses the sample student, real sign-in still required", () => {
  const views = readFileSync(new URL("../ios/App/App/NativeViews.swift", import.meta.url), "utf8");
  const review = readFileSync(new URL("../src/lib/review-account.ts", import.meta.url), "utf8");
  const email = review.match(/REVIEW_ACCOUNT_EMAIL = "([^"]+)"/)[1];
  assert.match(views, new RegExp(`static let email = "${email.replace(/\./g, "\\.")}"`));
  assert.match(core, /if preview \{\s+bundle = NativePreviewData\.bundle/);
});
