import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HEARTBEAT_FRESH_MS,
  PREFERENCES_FRESH_MS,
  PUSH_HEARTBEAT_PREF,
  lastServerCheck,
  pageShouldPopUp,
  serverIsChecking,
} from "../src/lib/push-heartbeat.ts";

const now = Date.parse("2026-10-03T18:00:00.000Z");
const checkedAgo = (ms) => ({ [PUSH_HEARTBEAT_PREF]: { checkedAt: new Date(now - ms).toISOString() } });

test("reads the server's last check from preferences", () => {
  assert.equal(lastServerCheck(checkedAgo(0)), now);
  assert.equal(lastServerCheck({}), null);
  assert.equal(lastServerCheck(undefined), null);
  assert.equal(lastServerCheck({ [PUSH_HEARTBEAT_PREF]: { checkedAt: "nonsense" } }), null);
  assert.equal(lastServerCheck({ [PUSH_HEARTBEAT_PREF]: "2026-10-03" }), null);
});

test("the server counts as checking for one missed run, not longer", () => {
  assert.equal(serverIsChecking(checkedAgo(15 * 60_000), now), true);
  assert.equal(serverIsChecking(checkedAgo(HEARTBEAT_FRESH_MS + 1), now), false);
  assert.equal(serverIsChecking({}, now), false);
});

test("a device without closed-app push still gets pop-ups from the open page", () => {
  assert.equal(
    pageShouldPopUp({ deviceHasBackgroundPush: false, preferences: checkedAgo(0), preferencesUpdatedAt: now, now }),
    true,
  );
});

test("a device with closed-app push keeps alerts in the bell while the server is checking", () => {
  assert.equal(
    pageShouldPopUp({ deviceHasBackgroundPush: true, preferences: checkedAgo(10 * 60_000), preferencesUpdatedAt: now, now }),
    false,
  );
});

test("the page takes over pop-ups only when fresh data shows the server stopped", () => {
  const stopped = checkedAgo(3 * 3_600_000);
  assert.equal(
    pageShouldPopUp({ deviceHasBackgroundPush: true, preferences: stopped, preferencesUpdatedAt: now, now }),
    true,
  );
  // Preferences restored from the offline cache are too old to judge by, so
  // opening the app never bursts out alerts the phone may already have shown.
  assert.equal(
    pageShouldPopUp({
      deviceHasBackgroundPush: true,
      preferences: stopped,
      preferencesUpdatedAt: now - PREFERENCES_FRESH_MS - 1,
      now,
    }),
    false,
  );
});
