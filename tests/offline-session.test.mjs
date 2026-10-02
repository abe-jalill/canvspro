import { test } from "node:test";
import assert from "node:assert/strict";
import { isOfflineLike, readStoredUser } from "../src/lib/offline-session.ts";

const storageOf = (entries) => {
  const keys = Object.keys(entries);
  return {
    length: keys.length,
    key: (i) => keys[i] ?? null,
    getItem: (k) => entries[k] ?? null,
  };
};
const session = (id, extra = {}) =>
  JSON.stringify({ access_token: "a", refresh_token: "r", user: { id, email: "x@y.z" }, ...extra });

test("offline or a retryable fetch failure counts as 'no network'", () => {
  assert.equal(isOfflineLike(null, false), true);
  assert.equal(isOfflineLike({ name: "AuthRetryableFetchError" }, true), true);
  assert.equal(isOfflineLike(null, true), false);
  assert.equal(isOfflineLike({ name: "AuthApiError" }, true), false);
});

test("a revoked or invalid session is not treated as offline", () => {
  assert.equal(isOfflineLike({ name: "AuthSessionMissingError" }, true), false);
});

test("reads the user from the Supabase session key", () => {
  const user = readStoredUser(
    storageOf({ "cp:u1:theme": "dark", "sb-abc123-auth-token": session("u1") }),
  );
  assert.equal(user?.id, "u1");
});

test("ignores unrelated keys, empty storage, corrupt JSON and sessions without a refresh token", () => {
  assert.equal(readStoredUser(storageOf({})), null);
  assert.equal(readStoredUser(storageOf({ "sb-abc-auth-token": "{not json" })), null);
  assert.equal(readStoredUser(storageOf({ "sb-abc-auth-token-code-verifier": "x" })), null);
  assert.equal(
    readStoredUser(
      storageOf({ "sb-abc-auth-token": JSON.stringify({ user: { id: "u1" } }) }),
    ),
    null,
  );
  assert.equal(
    readStoredUser(storageOf({ "sb-abc-auth-token": JSON.stringify({ user: {}, refresh_token: "r" }) })),
    null,
  );
});

test("storage that throws is treated as no stored session", () => {
  const broken = {
    length: 1,
    key: () => {
      throw new Error("denied");
    },
    getItem: () => null,
  };
  assert.equal(readStoredUser(broken), null);
});
