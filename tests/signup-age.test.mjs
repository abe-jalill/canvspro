import assert from "node:assert/strict";
import test from "node:test";
import {
  AGE_CONFIRMATION_VERSION,
  createAgeConfirmationMetadata,
} from "../src/lib/signup-age.ts";

test("signup cannot proceed without the 13-or-older confirmation", () => {
  assert.throws(
    () => createAgeConfirmationMetadata(false),
    /at least 13 years old/i,
  );
});

test("signup records an auditable age confirmation", () => {
  const now = new Date("2026-09-28T16:30:00.000Z");
  assert.deepEqual(createAgeConfirmationMetadata(true, now), {
    age_13_or_older_confirmed: true,
    age_confirmation_version: AGE_CONFIRMATION_VERSION,
    age_confirmed_at: now.toISOString(),
  });
});
