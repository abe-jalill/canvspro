import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const preferences = readFileSync(new URL("../src/lib/notification-prefs.ts", import.meta.url), "utf8");
const controls = readFileSync(new URL("../src/components/notification-settings.tsx", import.meta.url), "utf8");

test("website notification choices hydrate from the account before being uploaded", () => {
  assert.match(preferences, /from\("notification_prefs"\)[\s\S]*select\("prefs"\)/);
  assert.match(preferences, /setReady\(true\)/);
  assert.match(controls, /if \(!ready\) return;/);
  assert.doesNotMatch(controls, /if \(!background\) return;[\s\S]*syncPrefsToServer/);
});
