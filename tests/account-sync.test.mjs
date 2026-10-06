import test from "node:test";
import assert from "node:assert/strict";
import { profileText, accountProfileValue } from "../src/lib/profile-values.ts";
import { refreshAccountQueries, ACCOUNT_QUERY_ROOTS } from "../src/lib/account-refresh.ts";
import { createPreferenceEdits } from "../src/lib/preference-edits.ts";

test("cleared profile fields and deleted photos never fall back to old metadata", () => {
  assert.equal(profileText("", "old name"), "");
  assert.equal(profileText(null, "old name"), "");
  assert.equal(profileText(undefined, "legacy name"), "legacy name");
  assert.equal(profileText({ bad: true }), "");
  assert.equal(accountProfileValue({ avatar_path: null }, "avatar_path", "old/avatar"), "");
  assert.equal(accountProfileValue({ username: null }, "username", "old_username"), "");
  assert.equal(accountProfileValue(null, "username", "legacy_username"), "legacy_username");
});

test("another device's changes refresh even when this device's cache is fresh", async () => {
  const calls = [];
  await refreshAccountQueries({
    isMutating: () => 0,
    refetchQueries: async (filters, options) => {
      calls.push({ filters, options });
    },
  });
  assert.deepEqual(
    calls.map((call) => call.filters.queryKey[0]),
    [...ACCOUNT_QUERY_ROOTS],
  );
  assert.ok(
    calls.every((call) => !("stale" in call.filters) && call.options.cancelRefetch === false),
  );
});

test("background refresh does not overwrite optimistic edits still saving", async () => {
  let called = false;
  await refreshAccountQueries({
    isMutating: () => 1,
    refetchQueries: async () => {
      called = true;
    },
  });
  assert.equal(called, false);
});

test("a failed refresh does not stop unrelated account queries", async () => {
  let calls = 0;
  await refreshAccountQueries({
    isMutating: () => 0,
    refetchQueries: async () => {
      calls++;
      throw new Error("offline");
    },
  });
  assert.equal(calls, ACCOUNT_QUERY_ROOTS.length);
});

test("notification saves include only edited keys and preserve edits made during a save", () => {
  const edits = createPreferenceEdits();
  assert.deepEqual(edits.values(), {});
  edits.set("grades", false);
  const saving = edits.snapshot();
  edits.set("grades", true);
  edits.set("quietStart", 20);
  edits.acknowledge(saving);
  assert.deepEqual(edits.values(), { grades: true, quietStart: 20 });
  edits.acknowledge(edits.snapshot());
  assert.deepEqual(edits.values(), {});
});
