import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("src/routes/index.tsx");
const css = read("src/routes/home.css");

test("the homepage shows four real screens, each in light and dark", () => {
  const ids = [...page.matchAll(/id: "([a-z-]+)",\s+label:/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["dashboard", "coming-up", "study", "assignments"]);
  for (const id of ids) {
    for (const theme of ["light", "dark"]) {
      assert.ok(
        existsSync(new URL(`../public/home/${id}-${theme}.webp`, import.meta.url)),
        `${id}-${theme}`,
      );
    }
  }
  // Dark by default; light only for visitors who picked Light in the app.
  assert.match(page, /className="hp-shot-dark"/);
  assert.match(page, /className="hp-shot-light"/);
  assert.match(css, /:root\[data-theme-mode="light"\] \.hp \{/);
  assert.match(read("src/routes/__root.tsx"), /dataset\.themeMode=/);
});

test("the hero shows the product's job: a week that sorts itself into the order to do it", () => {
  assert.match(page, /function SortingWeek\(/);
  assert.match(page, /As Canvas lists them/);
  assert.match(page, /Sorted by CanvasPro/);
  assert.match(page, /aria-label=\{`Mark \$\{task.title\} done`\}/);
});

test("none of the generic AI-template patterns come back", () => {
  // Gradient text, glass panels, glow blobs and fake window chrome.
  assert.doesNotMatch(css, /background-clip:\s*text/);
  assert.doesNotMatch(css, /backdrop-filter/);
  assert.doesNotMatch(css, /blur\(\d/);
  assert.doesNotMatch(page, /hp-frame__dots|traffic/);
  // Eyebrow labels, counting stats, and icon-tile feature cards.
  assert.doesNotMatch(page, /kicker|data-count|lucide-react/);
});

test("motion respects Reduce Motion and the old homepage styles are gone", () => {
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(page, /prefers-reduced-motion: reduce/);
  assert.equal(existsSync(new URL("../src/routes/landing.css", import.meta.url)), false);
  assert.equal(existsSync(new URL("../src/routes/landing-motion.css", import.meta.url)), false);
});

test("the sample student only ever runs on the local dev server", () => {
  const demo = read("src/lib/demo-mode.ts");
  assert.match(demo, /if \(import\.meta\.env\.DEV\) installDemoMode\(\);/);
  assert.match(read("src/router.tsx"), /import "@\/lib\/demo-mode";/);
});
