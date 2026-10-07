import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/routes/_authenticated/study-session.tsx", import.meta.url),
  "utf8",
);

test("study session setup is two equal cards: pick and time on the left, session on the right", () => {
  assert.match(page, /grid items-stretch gap-5[^"]*lg:grid-cols-2/);
  // On desktop both cards fit the window; long lists scroll inside them.
  assert.ok(page.includes("lg:h-[calc(100dvh-13rem)]"));
  assert.ok(page.includes("lg:max-h-none lg:min-h-0 lg:flex-1"));
  assert.match(page, /title="Pick assignments"/);
  assert.match(page, /title="Choose time"/);
  assert.match(page, /title="Your session"/);
  // The right card shows the whole session as a ring, one arc per task.
  assert.match(page, /function SessionRing\(/);
  assert.match(page, /<SessionRing/);
});

test("a link can preselect several assignments with ?picks=", () => {
  assert.match(page, /picks\?: string/);
  assert.match(page, /requestedPicks \? requestedPicks\.split\(","\)\.map\(Number\)/);
});
