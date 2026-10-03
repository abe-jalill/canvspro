import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production cron dispatches closed-app notifications through canvaspro.app", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260927000000_fix_canvaspro_push_dispatch_url.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /https:\/\/canvaspro\.app\/api\/public\/push\/dispatch/);
  assert.doesNotMatch(migration, /lovable\.app/);
});

test("the installable web app has a background push worker", async () => {
  const [worker, manifest] = await Promise.all([
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  ]);
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /showNotification/);
  assert.equal(JSON.parse(manifest).display, "standalone");
});

test("the dispatch route checks accounts in parallel and records each check", async () => {
  const route = await readFile(
    new URL("../src/routes/api/public/push/dispatch.ts", import.meta.url),
    "utf8",
  );
  // The route still requires the cron secret, and takes an optional user id.
  assert.match(route, /constantTimeEqual\(provided, expected\)/);
  assert.match(route, /run\(userId \|\| undefined\)/);
  assert.match(route, /recordHeartbeat\(admin, userId\)/);
});
