import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { describeDevice, deviceLine } from "../src/lib/devices.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("each sign-in gets a readable device name", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  assert.deepEqual(describeDevice(mac), { name: "Chrome on Mac", kind: "computer" });
  assert.equal(describeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15").name, "Safari on Mac");
  assert.equal(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0").name, "Edge on Windows");
  assert.equal(describeDevice("Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0").name, "Firefox on Windows");
  assert.deepEqual(
    describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"),
    { name: "Safari on iPhone", kind: "phone" },
  );
  assert.equal(describeDevice("Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile Safari/604.1").kind, "tablet");
  assert.equal(describeDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36").name, "Chrome on Android");
  // The iPhone app signs in without a browser.
  assert.deepEqual(describeDevice("CoursePro/12 CFNetwork/1494.0.7 Darwin/23.4.0"), { name: "CoursePro for iPhone", kind: "phone" });
  assert.equal(describeDevice("python-requests/2.31").name, "Another app");
  assert.equal(describeDevice(null).name, "Unknown device");
});

test("each device says when it signed in and was last active", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  const at = (minutes) => new Date(now - minutes * 60_000).toISOString();
  assert.match(deviceLine({ created_at: at(3 * 1440), last_active_at: at(1) }, now), /^Signed in .+ · Active now$/);
  assert.match(deviceLine({ created_at: at(3 * 1440), last_active_at: at(20) }, now), /· Active 20 minutes ago$/);
  assert.match(deviceLine({ created_at: at(3 * 1440), last_active_at: at(180) }, now), /· Active 3 hours ago$/);
  assert.match(deviceLine({ created_at: at(9 * 1440), last_active_at: at(5 * 1440) }, now), /· Active 5 days ago$/);
});

test("the account can list its sign-ins and end one, the others, or all", () => {
  const sql = read("supabase/migrations/20261022120000_signed_in_devices.sql");
  for (const fn of ["list_my_sessions()", "my_session_active()", "revoke_my_session(uuid)", "revoke_my_other_sessions()"]) {
    assert.ok(sql.includes(`grant execute on function public.${fn} to authenticated;`), fn);
    assert.ok(sql.includes(`revoke all on function public.${fn} from public, anon;`), fn);
  }
  // Only the caller's own sign-ins, and their notifications go with them.
  assert.match(sql, /delete from auth\.sessions where id = target and user_id = uid;/);
  assert.match(sql, /delete from auth\.sessions where user_id = uid and id <> current_sid;/);
  assert.match(sql, /perform public\.forget_session_push\(uid, array\[target\], null\);/);
  assert.match(sql, /create trigger push_subscriptions_session\s+before insert or update on public\.push_subscriptions/);
  // A token that doesn't say which sign-in it is never reads as signed out.
  assert.match(sql, /when public\.current_session_id\(\) is null then null/);

  const page = read("src/routes/_authenticated/settings.devices.tsx");
  assert.match(page, /supabase\.rpc\("list_my_sessions"\)/);
  assert.match(page, /supabase\.rpc\("revoke_my_session", \{ target: id \}\)/);
  assert.match(page, /supabase\.rpc\("revoke_my_other_sessions"\)/);
  // Everywhere: the others first, then this browser.
  assert.match(page, /await endOthers\.mutateAsync\(\);[\s\S]*await signOut\("Signed out on every device\."\);/);
  assert.match(read("src/routes/_authenticated/settings.index.tsx"), /to: "\/settings\/devices" as const,/);
});

test("a browser signed out elsewhere leaves promptly, and only on a clear no", () => {
  const watch = read("src/hooks/use-session-watch.ts");
  assert.match(watch, /supabase\.rpc\("my_session_active"\)/);
  assert.match(watch, /if \(cancelled \|\| error \|\| data !== false \|\| signingOut\) return;/);
  assert.match(watch, /You were signed out from another device\./);
  assert.match(read("src/routes/_authenticated/route.tsx"), /useSessionWatch\(true\);/);
});

test("signing out stops this browser's notifications for the account", () => {
  const hook = read("src/hooks/use-sign-out.ts");
  assert.match(hook, /await forgetBrowserPushForAccount\(\)\.catch\(\(\) => undefined\);\s+const \{ error \} = await supabase\.auth\.signOut\(\{ scope: "local" \}\);/);
  const push = read("src/lib/push-client.ts");
  // The row goes; the browser keeps its subscription, so signing in again re-registers it.
  assert.match(push, /export async function forgetBrowserPushForAccount\(\): Promise<void> \{[\s\S]*?await supabase\.from\("push_subscriptions"\)\.delete\(\)\.eq\("endpoint", sub\.endpoint\);\s+\}/);
  assert.doesNotMatch(push.split("export async function forgetBrowserPushForAccount")[1].split("export async function disableBackgroundPush")[0], /unsubscribe\(\)/);
  const sidebar = read("src/components/app-sidebar.tsx");
  assert.match(sidebar, /import \{ useSignOut \} from "@\/hooks\/use-sign-out";/);
  assert.match(sidebar, /onClick=\{\(\) => void signOut\(\)\}/);
});
