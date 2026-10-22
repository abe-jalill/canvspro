import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readStudySetup } from "../src/lib/study-session.ts";

// What a student sees, reads, dismisses and chooses is saved to the account,
// so the website on every device and the iPhone app agree.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("an open tab picks up changes from other devices", () => {
  const prefs = read("src/hooks/use-user-preferences.ts");
  assert.match(prefs, /refetchOnWindowFocus: \(\) => idle\(\)/);
  assert.match(prefs, /refetchInterval: \(\) => \(idle\(\) \? SYNC_INTERVAL_MS : false\)/);
  assert.match(prefs, /const SYNC_INTERVAL_MS = 30_000;/);
});

test("the bell's read and removed alerts are the same on every device", () => {
  const n = read("src/lib/notifications.ts");
  assert.match(n, /export const NOTIFICATIONS_STATE_KEY = "notifications-state";/);
  for (const action of ["markRead", "markAllRead", "remove", "clear"]) {
    assert.match(n, new RegExp(`const ${action} = useCallback\\([\\s\\S]*?save\\(`), action);
  }
  // Read elsewhere: listed as read here, with no pop-up.
  assert.match(n, /if \(isRemovedInSync\(created\)\) return false;/);
  assert.match(n, /return !read_;/);
  assert.match(n, /const next = applySyncState\(current, synced\);/);
});

test("To-Do grouping, study setup and the streak celebration are the account's", () => {
  assert.match(read("src/routes/_authenticated/focus.tsx"), /const TODO_GROUPING_KEY = "todo-grouping";/);
  const study = read("src/routes/_authenticated/study-session.tsx");
  assert.match(study, /const STUDY_SETUP_KEY = "study-setup";/);
  assert.match(study, /saveTimer\.current = window\.setTimeout\(\(\) => studySetup\.set\(setup\), 800\);/);
  assert.match(read("src/components/streak.tsx"), /if \(celebrated\.value === data\.today\) return;/);

  // The iPhone saves custom lengths as numbers like 25.0; both read the same.
  assert.deepEqual(
    readStudySetup({ mode: "pomodoro", preset: "custom", custom: { focus: 40.0, shortBreak: 7, longBreak: 99, rounds: 1 } }),
    { mode: "pomodoro", preset: "custom", custom: { focus: 40, shortBreak: 7, longBreak: 60, rounds: 2 } },
  );
  assert.equal(readStudySetup({ mode: "nope" }), null);
  assert.equal(readStudySetup({ mode: "total", preset: "odd" }).preset, "classic");
});
