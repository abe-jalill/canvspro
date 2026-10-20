import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/routes/_authenticated/study-session.tsx", import.meta.url),
  "utf8",
);

test("study session setup: the full list on the left, the session panel on the right", () => {
  assert.match(page, /grid items-start gap-5 lg:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(0,1fr\)\]/);
  // The cards take their natural height. Locking them to the window squeezed
  // the fixed-size ring into the text and Start button on shorter screens.
  assert.doesNotMatch(page, /\d+dvh/);
  assert.doesNotMatch(page, /min-h-0/);
  // No short scroll box hiding the list: six show, then "Show N more".
  assert.doesNotMatch(page, /max-h-\[17\.5rem\]/);
  assert.match(page, /const SHORT_LIST = 6;/);
  assert.match(page, /Show \{candidates\.length - SHORT_LIST\} more/);
  assert.match(page, /title="Pick assignments"/);
  assert.match(page, /title="Choose time"/);
  assert.match(page, /title="Your session"/);
  // The session panel stays in view and shows the whole session as a ring,
  // one arc per task, with the time inside it.
  assert.match(page, /className="premium-reveal lg:sticky lg:top-4"/);
  assert.match(page, /function SessionRing\(/);
  assert.match(page, /<div className="absolute inset-0 flex flex-col items-center justify-center text-center">/);
  assert.match(page, /<SessionRing/);
});

test("a link can preselect several assignments with ?picks=", () => {
  assert.match(page, /picks\?: string/);
  assert.match(page, /requestedPicks \? requestedPicks\.split\(","\)\.map\(Number\)/);
});
