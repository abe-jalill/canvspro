import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Settings > Signed-in devices, as on the website: every sign-in on the
// account, and sign out of one, the others, or everywhere.
const read = (name) => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const core = read("NativeCore");
const more = read("NativeMoreViews");
const views = read("NativeViews");

test("signing out of the iPhone ends only this sign-in", () => {
  assert.match(core, /request\(path: "\/auth\/v1\/logout", token: token, query: \[\.init\(name: "scope", value: "local"\)\]\)/);
});

test("the devices screen uses the website's account functions", () => {
  assert.match(more, /settingsLink\("Signed-in devices", "laptopcomputer\.and\.iphone"\) \{ NativeDevicesView\(sessionStore: sessionStore\) \}/);
  assert.match(more, /rpc\("list_my_sessions", token: token\)/);
  assert.match(more, /rpc\("revoke_my_session", token: token, body: \["target": id\]\)/);
  assert.match(more, /rpc\("revoke_my_other_sessions", token: token\)/);
  assert.match(more, /case createdAt = "created_at"; case lastActiveAt = "last_active_at"/);
  // This iPhone signs out itself; everywhere ends the others first.
  assert.match(more, /if device\.isCurrent \{ confirmingSignOut = true; return \}/);
  assert.match(more, /if await endOthers\(\) \{ await sessionStore\.signOut\(\) \}/);
  assert.match(more, /\.confirmationDialog\("Sign out everywhere\?"/);
});

test("device names read the same as the website's", () => {
  assert.match(more, /if has\("CoursePro-iOS\|CFNetwork\|Darwin\/"\) && !has\("Mozilla"\) \{ return Description\(name: "CoursePro for iPhone"/);
  assert.match(more, /return Description\(name: os\.map \{ "\\\(browser\) on \\\(\$0\)" \} \?\? browser, symbol: symbol\)/);
  // Postgres sends microseconds.
  assert.match(more, /replacingOccurrences\(of: #"\\\.\\d\+"#, with: "", options: \.regularExpression\)/);
});

test("signed out from another device: back to sign-in, and only on a clear no", () => {
  assert.match(core, /guard await api\.sessionIsActive\(token: token\) == false, session != nil else \{ return \}/);
  assert.match(core, /errorMessage = "You were signed out from another device\."/);
  assert.match(more, /case "false": return false\s+default: return nil/);
  assert.match(views, /\.task \{ await sessionStore\.watchSignIn\(\) \}/);
  assert.match(views, /Task \{ await sessionStore\.checkSignInStillActive\(\) \}/);
});
