import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createLegalConsentMetadata, LEGAL_POLICY_VERSION } from "../src/lib/legal-consent.ts";

test("legal acceptance is required and records the specific policy versions", () => {
  assert.throws(
    () => createLegalConsentMetadata(false),
    /agree to the Terms of Use and Privacy Policy/,
  );
  assert.deepEqual(createLegalConsentMetadata(true, new Date("2026-09-28T12:00:00Z")), {
    terms_accepted_version: LEGAL_POLICY_VERSION,
    privacy_accepted_version: LEGAL_POLICY_VERSION,
    legal_accepted_at: "2026-09-28T12:00:00.000Z",
  });
});

test("both authentication forms check agreement before authenticating", () => {
  for (const route of ["auth", "signup"]) {
    const source = readFileSync(new URL(`../src/routes/${route}.tsx`, import.meta.url), "utf8");
    const guard = source.indexOf("createLegalConsentMetadata(legalAccepted)");
    const request = source.indexOf(
      route === "auth" ? "supabase.auth.signInWithPassword" : "supabase.auth.signUp",
    );
    assert.ok(guard > 0 && guard < request);
    assert.match(source, /\[legalAccepted, setLegalAccepted\] = useState\(false\)/);
    assert.match(source, /<LegalConsent checked=\{legalAccepted\}/);
  }
});

test("account deletion explicitly includes account-linked usage history", () => {
  const source = readFileSync(new URL("../src/lib/account.functions.ts", import.meta.url), "utf8");
  assert.match(source, /"user_activity_daily"/);
});
