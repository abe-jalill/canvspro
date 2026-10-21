import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { completedEntries, completedGroupLabel } from "../src/lib/completed-list.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const assignment = (id, extra = {}) => ({ id, name: `Work ${id}`, course_id: 1, due_at: null, submission: null, ...extra });

test("completed work is listed most recent first, whether ticked off here or done in Canvas", () => {
  const entries = completedEntries(
    [
      assignment(1),
      assignment(2, { submission: { submitted_at: "2026-10-18T12:00:00Z" } }),
      assignment(3),
      assignment(4, { due_at: "2026-10-01T12:00:00Z" }),
    ],
    (a) => a.id !== 3,
    (id) => id === 1 || id === 4,
    { 1: { completed: true, completedAt: "2026-10-19T09:00:00Z", dueAt: null } },
  );
  assert.deepEqual(entries.map((e) => e.assignment.id), [1, 2, 4]);
  assert.equal(entries[0].inCanvas, false);
  assert.equal(entries[1].inCanvas, true);
  // No completion time saved: falls back to the due date.
  assert.equal(entries[2].doneAt, Date.parse("2026-10-01T12:00:00Z"));
});

test("finished work is grouped by when it was done", () => {
  const now = new Date(2026, 9, 19, 15).getTime();
  assert.equal(completedGroupLabel(new Date(2026, 9, 19, 8).getTime(), now), "Today");
  assert.equal(completedGroupLabel(new Date(2026, 9, 18, 23).getTime(), now), "Yesterday");
  assert.equal(completedGroupLabel(new Date(2026, 9, 14, 9).getTime(), now), "Past week");
  assert.equal(completedGroupLabel(new Date(2026, 9, 2).getTime(), now), "Earlier");
  assert.equal(completedGroupLabel(null, now), "Earlier");
});

test("every way of marking work complete plays the exit and shows one undo bar", () => {
  const synced = read("src/lib/synced-state.ts");
  assert.match(synced, /startCompletionExit\(k, \(\) => write\(true\)/);
  assert.match(synced, /showCompletionUndo\(\{ id: k, name, undo: \(\) => \{\s*if \(!cancelCompletionExit\(k\)\) write\(false\);/);
  // Unticking during the exit cancels the save instead of writing twice.
  assert.match(synced, /if \(cancelCompletionExit\(k\)\) dismissCompletionUndo\(\);\s*else write\(false\);/);
  const motion = read("src/lib/completion-motion.ts");
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /if \(settled\(\) \|\| waited >= 4000\)/);
  const layout = read("src/routes/_authenticated/route.tsx");
  assert.match(layout, /<CompletionUndoBar \/>/);
  const bar = read("src/components/completion-undo-bar.tsx");
  assert.match(bar, /Marked complete/);
  assert.match(bar, />\s*<RotateCcw[^>]*\/>\s*Undo\s*</);
  // The old small toast on Coming Up is gone, so there is only one undo.
  assert.doesNotMatch(read("src/routes/_authenticated/focus.tsx"), /toast\.success\("Marked complete"/);
  for (const file of ["src/routes/_authenticated/assignments.tsx", "src/components/priority-assignments.tsx", "src/components/widgets/dashboard-widgets.tsx"]) {
    assert.match(read(file), /<CompletionRow\s+assignmentId=/, file);
  }
});

test("Completed opens a page of its own with a back arrow", () => {
  const page = read("src/routes/_authenticated/completed.tsx");
  assert.match(page, /aria-label="Back"/);
  assert.match(page, /router\.history\.canGoBack\(\)/);
  assert.match(read("src/routes/_authenticated/route.tsx"), /const BARE_PAGES = new Set\(\["\/completed"[,\]]/);
  assert.match(read("src/routes/_authenticated/focus.tsx"), /<CompletedLink \/>/);
  assert.match(read("src/routes/_authenticated/assignments.tsx"), /<CompletedLink \/>/);
});
