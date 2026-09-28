import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { createRequestCache } from "../src/lib/request-cache.ts";
import { restoreQueryCache } from "../src/lib/query-persist.ts";

test("requests still deduplicate after more than two seconds in flight", async () => {
  let time = 0,
    calls = 0,
    finish;
  const cache = createRequestCache(2000, () => time);
  const load = () => {
    calls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const first = cache.get("a", load);
  await Promise.resolve();
  time = 10000;
  assert.equal(cache.get("a", load), first);
  finish(42);
  assert.equal(await first, 42);
  assert.equal(calls, 1);
  assert.equal(cache.get("a", load), first);
});

test("account changes and explicit refresh do not reuse an old request", async () => {
  const cache = createRequestCache();
  assert.equal(await cache.get("a", async () => "a"), "a");
  assert.equal(await cache.get("b", async () => "b"), "b");
  cache.clear();
  assert.equal(await cache.get("b", async () => "fresh"), "fresh");
});

test("a failed request can be retried immediately", async () => {
  const cache = createRequestCache();
  await assert.rejects(
    cache.get("a", async () => {
      throw new Error("offline");
    }),
  );
  assert.equal(await cache.get("a", async () => "online"), "online");
});

test("cache restore is synchronous, scoped, expiring, and excludes auth/preferences", () => {
  const source = new QueryClient();
  source.setQueryData(["canvas", "courses"], [{ id: 42 }]);
  source.setQueryData(["auth-user"], "a");
  source.setQueryData(["user-preferences", "a"], { stale: true });
  const saved = { version: 6, userId: "a", savedAt: Date.now(), state: dehydrate(source) };
  let raw = JSON.stringify(saved);
  globalThis.window = {};
  globalThis.localStorage = { getItem: () => raw };
  const restored = new QueryClient();
  restoreQueryCache(restored, "a");
  assert.deepEqual(restored.getQueryData(["canvas", "courses"]), [{ id: 42 }]);
  assert.equal(restored.getQueryData(["auth-user"]), undefined);
  assert.equal(restored.getQueryData(["user-preferences", "a"]), undefined);
  const wrongUser = new QueryClient();
  restoreQueryCache(wrongUser, "b");
  assert.equal(wrongUser.getQueryCache().getAll().length, 0);
  raw = JSON.stringify({ ...saved, version: 5 });
  const oldVersion = new QueryClient();
  restoreQueryCache(oldVersion, "a");
  assert.equal(oldVersion.getQueryCache().getAll().length, 0);
  raw = JSON.stringify({ ...saved, savedAt: Date.now() - 25 * 60 * 60_000 });
  const expired = new QueryClient();
  restoreQueryCache(expired, "a");
  assert.equal(expired.getQueryCache().getAll().length, 0);
  raw = "broken json";
  assert.doesNotThrow(() => restoreQueryCache(expired, "a"));
  raw = JSON.stringify({ buster: "v2", timestamp: Date.now(), clientState: saved.state });
  restoreQueryCache(expired, "a");
  assert.equal(expired.getQueryData(["canvas", "courses"]), undefined);
  source.clear();
  restored.clear();
  wrongUser.clear();
  oldVersion.clear();
  expired.clear();
  delete globalThis.window;
  delete globalThis.localStorage;
});
