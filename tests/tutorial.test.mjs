import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Settings has an animated tutorial, the same seven steps as the iPhone app", () => {
  assert.match(read("src/routes/_authenticated/settings.index.tsx"), /to: "\/settings\/tutorial" as const,/);
  const tour = read("src/components/tutorial/tutorial-tour.tsx");
  const titles = [...tour.matchAll(/title: "([^"]+)",\n\s+body:/g)].map((m) => m[1]);
  assert.deepEqual(titles, [
    "Welcome to CoursePro",
    "See what's due",
    "Add your own tasks",
    "Your week on the calendar",
    "Study one thing at a time",
    "Every class at a glance",
    "Stay ahead, everywhere",
  ]);
  // Arrow keys and swipes move between steps; each scene restarts its animation.
  assert.match(tour, /if \(e\.key === "ArrowRight"\) go\(step \+ 1\);/);
  assert.match(tour, /go\(end < start \? step \+ 1 : step - 1\);/);
  assert.match(tour, /<div\s+key=\{step\}/);
});

test("the scenes move, and stand still with Reduce Motion", () => {
  const css = read("src/components/tutorial/tutorial.css");
  for (const name of ["tut-check", "tut-sheet", "tut-ring", "tut-grow", "tut-drop", "tut-rise"]) {
    assert.match(css, new RegExp(`@keyframes ${name} \\{`), name);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s+\.tut-anim \{ animation: none !important; \}/);
});

test("Today offers the tour once, on every device", () => {
  const invite = read("src/components/tutorial/tour-invite.tsx");
  assert.match(invite, /if \(!seen\.ready \|\| seen\.value === true\) return null;/);
  assert.match(invite, /onClick=\{\(\) => seen\.set\(true\)\}/);
  assert.match(read("src/components/tutorial/tutorial-tour.tsx"), /export const TUTORIAL_SEEN_KEY = "tutorial-seen";/);
  assert.match(read("src/routes/_authenticated/dashboard.tsx"), /\{!layout\.needsPicks && <TourInvite \/>\}/);
});
