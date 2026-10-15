import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  REVIEW_ACCOUNT_EMAIL,
  emailFromAuthorization,
  isReviewAccount,
} from "../src/lib/review-account.ts";

const token = (claims) =>
  `Bearer eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;

test("only App Review's address counts as the review account", () => {
  assert.equal(REVIEW_ACCOUNT_EMAIL, "app.preview@canvaspro.app");
  assert.equal(isReviewAccount("app.preview@canvaspro.app"), true);
  assert.equal(isReviewAccount(" App.Preview@CanvasPro.app "), true);
  assert.equal(isReviewAccount("app.preview@canvaspro.app.evil.com"), false);
  assert.equal(isReviewAccount("student@school.edu"), false);
  assert.equal(isReviewAccount(null), false);
  assert.equal(isReviewAccount(undefined), false);
});

test("the email is read from a signed-in request's access token", () => {
  assert.equal(
    emailFromAuthorization(
      token({ sub: "u1", email: "app.preview@canvaspro.app", role: "authenticated" }),
    ),
    "app.preview@canvaspro.app",
  );
  // Non-ASCII names elsewhere in the token don't stop the email being read.
  assert.equal(
    emailFromAuthorization(token({ email: "maya@school.edu", user_metadata: { name: "Zoë" } })),
    "maya@school.edu",
  );
});

test("signed-out, publishable-key and malformed requests have no email", () => {
  assert.equal(emailFromAuthorization(null), null);
  assert.equal(emailFromAuthorization("Bearer sb_publishable_abc123"), null);
  assert.equal(emailFromAuthorization(token({ role: "anon" })), null);
  assert.equal(emailFromAuthorization("Bearer not.base64!.x"), null);
  assert.equal(emailFromAuthorization("Basic abc.def.ghi"), null);
});

test("the review account sees sample Canvas data in production, the full demo stays dev-only", () => {
  const demo = readFileSync(new URL("../src/lib/demo-mode.ts", import.meta.url), "utf8");
  assert.match(demo, /if \(import\.meta\.env\.DEV\) installDemoMode\(\);/);
  // A named call: "sideEffects": false drops a bare `import "@/lib/demo-mode"` in production.
  const router = readFileSync(new URL("../src/router.tsx", import.meta.url), "utf8");
  assert.match(router, /import \{ installReviewAccountMode \} from "@\/lib\/demo-mode";/);
  assert.match(router, /\ninstallReviewAccountMode\(\);/);
  const review = demo.slice(
    demo.indexOf("function answerReview"),
    demo.indexOf("function installReviewAccountMode"),
  );
  // Canvas data and the "Canvas connected" check are sample; a newly typed key is checked for real.
  assert.match(review, /"\/functions\/v1\/canvas"\) \{[\s\S]*sampleCanvas\(resource\)/);
  assert.match(review, /typeof body\.token === "string" \? null/);
  assert.match(review, /rpc\/has_canvas_key"\) return json\(true\)/);
  // Nothing else is answered, so sign-in and the account's own settings stay real.
  assert.doesNotMatch(review, /\/auth\/v1|tableRows/);
});
