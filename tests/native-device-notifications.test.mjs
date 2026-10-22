import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL(`../ios/App/App/${path}`, import.meta.url), "utf8");

test("the iPhone device switch never changes the account master", () => {
  const view = read("NativeMoreViews.swift");
  const device = view
    .split("private func setDevice(_ on: Bool) async {")[1]
    .split("/// Saves a moment")[0];
  assert.match(view, /row\("Notifications on this iPhone"[\s\S]*setDevice\(on\)/);
  assert.match(view, /row\("Allow notifications on all devices"[\s\S]*set: setAllDevices/);
  assert.match(device, /NativeLocalReminders\.deviceEnabled = on/);
  assert.doesNotMatch(device, /notificationPreferences\.[a-zA-Z]+ =/);
  assert.match(device, /if !on \{ center\.removeAllPendingNotificationRequests\(\) \}/);
  assert.match(device, /api\.deletePushToken\(deviceToken, token: access\)/);
  assert.match(device, /catch \{[\s\S]*Retain the token/);
});

test("an unrelated notification edit cannot restore a stale all-devices value", () => {
  const features = read("NativeFeatures.swift");
  const core = read("NativeCore.swift");
  assert.match(features, /current\.dictionary\.filter/);
  assert.match(features, /syncNotificationPreferences\(changes,/);
  assert.match(core, /path: "\/rest\/v1\/rpc\/patch_notification_preferences"/);
  assert.doesNotMatch(
    core.split("func syncNotificationPreferences")[1].split("func upsert(")[0],
    /upsert\(table: "notification_prefs"/,
  );
});

test("an in-flight push registration and queued local reminders honor a device opt-out", () => {
  const views = read("NativeViews.swift");
  assert.match(
    views,
    /upsertPushToken\([\s\S]*guard NativeLocalReminders\.deviceEnabled[\s\S]*api\.deletePushToken\(deviceToken, token: access\)/,
  );
  assert.match(
    views,
    /guard NativeLocalReminders\.deviceEnabled, features\.notificationPreferences\.enabled/,
  );
  assert.match(
    read("NativeFeatures.swift"),
    /if !deviceEnabled \{ center\.removePendingNotificationRequests/,
  );
  const streak = read("NativeCelebrations.swift");
  assert.match(streak, /queue = Task \{\s+await previous\?\.value/);
  assert.match(
    streak,
    /if !NativeLocalReminders\.deviceEnabled \{ center\.removePendingNotificationRequests/,
  );
});
