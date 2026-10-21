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

test("the running session: a lit timer card beside the session's tasks", () => {
  const css = readFileSync(new URL("../src/targeted-design.css", import.meta.url), "utf8");
  assert.match(page, /className="study-focus-card premium-reveal/);
  assert.match(page, /title="This session"/);
  // The ring empties as time runs and isn't drawn at all once it's out, so a
  // new block never starts with a stray dot.
  assert.match(page, /\{left > 0 && \(\s+<circle\s+className="study-clock__progress"/);
  assert.match(page, /strokeDasharray=\{`\$\{circumference \* left\} \$\{circumference\}`\}/);
  // Past an hour the reading gets a smaller size so "1:29:57" fits the ring.
  assert.match(page, /data-long=\{time\.split\(":"\)\.length > 2 \? "" : undefined\}/);
  assert.match(css, /\.study-clock\[data-long\] \.study-clock__time span \{\s+font-size: 3rem;\s+font-size: 18cqi;/);
  assert.match(css, /\.study-clock \{[^}]*container-type: inline-size;/);
});

test("the running session's controls only do what they say", () => {
  // Tapping the task on screen doesn't restart a per-task timer.
  assert.match(page, /if \(index === session\.currentIndex\) return;\s+setSession\(focusItem\(session, index, Date\.now\(\)\)\);/);
  // Previous and next only show when there's another task to go to.
  assert.match(page, /const several = session\.items\.length > 1;/);
  assert.match(page, /\{several && \(\s+<button[\s\S]*?aria-label="Previous task"/);
  // Ending asks in the app's own dialog, not the browser's.
  assert.doesNotMatch(page, /window\.confirm/);
  assert.match(page, /<AlertDialogTitle>End this session\?<\/AlertDialogTitle>/);
});
