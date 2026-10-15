import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nativeAlertAllowed, nativeDelivered } from "../src/lib/native-push.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("iPhones get only what the phone can't schedule itself", () => {
  assert.equal(nativeAlertAllowed("grade:123:95"), true);
  assert.equal(nativeAlertAllowed("announcement:77"), true);
  // The phone plans these on its own; sending them too would buzz twice.
  for (const id of [
    "due:5:due1d",
    "class:2026-10-15:600:Physics:15",
    "tonight:2026-10-15:18",
    "streak:2026-10-15:18",
  ]) {
    assert.equal(nativeAlertAllowed(id), false, id);
  }
});

test("only alert ids that were asked for count as delivered", () => {
  assert.deepEqual(
    [...nativeDelivered({ delivered: ["grade:1:90", "grade:9:99", 4] }, ["grade:1:90"])],
    ["grade:1:90"],
  );
  assert.equal(nativeDelivered(null, ["grade:1:90"]).size, 0);
  assert.equal(nativeDelivered({ sent: 1 }, ["grade:1:90"]).size, 0);
  assert.equal(
    nativeDelivered({ reason: "apns-not-configured", delivered: [] }, ["grade:1:90"]).size,
    0,
  );
});

test("the device table: each student manages only their own phones", () => {
  const sql = read("drizzle/migrations/0018_native_push_tokens.sql");
  assert.match(read("drizzle/migrations/meta/_journal.json"), /"0018_native_push_tokens"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.native_push_tokens/);
  assert.match(sql, /token text NOT NULL UNIQUE/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /USING \(auth\.uid\(\) = user_id\)\s+WITH CHECK \(auth\.uid\(\) = user_id\)/);
  assert.doesNotMatch(sql, /REVOKE/);
});

test("the 30-minute job keeps its name, URL and schedule and now visits iPhone-only students", () => {
  const sql = read("drizzle/migrations/0018_native_push_tokens.sql");
  assert.match(sql, /^-- lovable-cron-fallback-reviewed:/);
  assert.match(sql, /cron\.schedule\(\s*'canvaspro-push-dispatch',\s*'\*\/30 10-23,0-3 \* \* \*'/);
  assert.match(sql, /url := 'https:\/\/canvaspro\.app\/api\/public\/push\/dispatch'/);
  assert.match(
    sql,
    /SELECT user_id FROM public\.push_subscriptions\s+UNION\s+SELECT user_id FROM public\.native_push_tokens/,
  );
  assert.match(sql, /WHERE public\.has_canvaspro_access\(accounts\.user_id\)/);
  // The 5-minute scheduled job is untouched.
  assert.doesNotMatch(sql, /canvaspro-push-scheduled/);
});

test("the apns function checks the cron secret and tells the app where to go", () => {
  const fn = read("supabase/functions/apns/index.ts");
  assert.match(fn, /sameSecret\(req\.headers\.get\("x-cron-secret"\) \?\? "", expected\)/);
  // AppDelegate opens to_path when the notification is tapped.
  assert.match(fn, /to_path: alert\.to/);
  assert.match(fn, /delivered\.push\(alert\.id\)/);
  assert.match(fn, /reason: "apns-not-configured"/);
  assert.match(read("supabase/config.toml"), /\[functions\.apns\]\s+verify_jwt = false/);
});

test("the dispatch sends iPhones through the function, and web push is unchanged without one", () => {
  const dispatch = read("src/routes/api/public/push/dispatch.ts");
  assert.match(dispatch, /admin\.functions\.invoke\("apns"/);
  assert.match(dispatch, /headers: \{ "x-cron-secret": cronSecret \}/);
  // run() reads the cron secret itself; the route's call is unchanged.
  assert.match(dispatch, /return run\(userId \|\| undefined\);/);
  assert.match(dispatch, /const cronSecret = await iphoneCronSecret\(supabaseAdmin\);/);
  // Web-only accounts take the old path: no iPhone unless one is registered.
  assert.match(dispatch, /iphone: \{ cronSecret: string \} \| null = null/);
  assert.match(dispatch, /iphoneUsers\.has\(userId\) \? \{ cronSecret \} : null/);
  // iPhone-only accounts don't queue reminders the phone already schedules.
  assert.match(dispatch, /const iphoneOnly = iphone !== null && !userSubs\.some/);
  // A missing table or failed lookup never stops web push.
  assert.match(dispatch, /if \(error\) return new Set\(\);/);
});
