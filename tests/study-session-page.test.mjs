import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/routes/_authenticated/study-session.tsx", import.meta.url),
  "utf8",
);

test("study session setup is two equal cards: pick and time on the left, session on the right", () => {
  assert.match(page, /grid items-stretch gap-5[^"]*lg:grid-cols-2/);
  // The cards take their natural height. Locking them to the window squeezed
  // the fixed-size ring into the text and Start button on shorter screens.
  assert.doesNotMatch(page, /\d+dvh/);
  assert.doesNotMatch(page, /min-h-0/);
  // Long lists scroll inside their card instead.
  assert.ok(page.includes('<ul className="max-h-[17.5rem] space-y-2 overflow-y-auto pr-1">'));
  assert.ok(page.includes('<ol className="max-h-[17.5rem] space-y-2 overflow-y-auto pr-1">'));
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
