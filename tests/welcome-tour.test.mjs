import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  hasSeenWelcomeTour,
  markWelcomeTourSeen,
  WELCOME_TOUR_STORAGE_KEY,
} from "../src/lib/welcome-tour.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const tour = read("src/components/welcome-tour.tsx");
const page = read("src/routes/index.tsx");

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

test("the tutorial shows until it has been skipped or finished once", () => {
  const storage = memoryStorage();
  assert.equal(hasSeenWelcomeTour(storage), false);
  markWelcomeTourSeen(storage);
  assert.equal(storage.getItem(WELCOME_TOUR_STORAGE_KEY), "1");
  assert.equal(hasSeenWelcomeTour(storage), true);
});

test("blocked storage never breaks the page and never nags", () => {
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(hasSeenWelcomeTour(blocked), true);
  assert.doesNotThrow(() => markWelcomeTourSeen(blocked));
});

test("the tutorial teaches four steps and ends at account creation and sign in", () => {
  const ids = [...tour.matchAll(/id: "([a-z-]+)",\s+title:/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["dashboard", "coming-up", "study", "setup"]);
  assert.match(tour, /to="\/signup"/);
  assert.match(tour, /to="\/auth"/);
  assert.match(tour, /Skip/);
});

test("every screenshot the tutorial shows exists in light and dark", () => {
  const images = [...tour.matchAll(/image: "([a-z-]+)"/g)].map((match) => match[1]);
  assert.ok(images.length >= 3);
  for (const id of images) {
    for (const theme of ["light", "dark"]) {
      assert.ok(existsSync(new URL(`../public/home/${id}-${theme}.webp`, import.meta.url)), id);
    }
  }
});

test("only signed-out first-time visitors get it, and anyone can reopen it", () => {
  assert.match(page, /if \(!data\.session && !hasSeenWelcomeTour\(\)\) setTourOpen\(true\)/);
  assert.match(page, /markWelcomeTourSeen\(\)/);
  assert.match(page, /How it works/);
  // Opened from an effect, so the server-rendered page never differs from the client's.
  assert.match(page, /const \[tourOpen, setTourOpen\] = useState\(false\)/);
});
