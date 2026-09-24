import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedProPriceKey } from "../src/lib/payment-plans.ts";
import { assertSafeReturnUrl } from "../src/lib/return-url.server.ts";
import { verifyWebhook } from "../src/lib/stripe.server.ts";

test("checkout only accepts the published Pro plans", () => {
  assert.equal(isAllowedProPriceKey("pro_monthly"), true);
  assert.equal(isAllowedProPriceKey("pro_yearly"), true);
  assert.equal(isAllowedProPriceKey("free"), false);
  assert.equal(isAllowedProPriceKey("price_cheap_attacker_choice"), false);
});

test("payment return URLs reject open redirects and insecure remote origins", () => {
  assert.equal(
    assertSafeReturnUrl("https://canvaspro.app/checkout/return?session_id={CHECKOUT_SESSION_ID}"),
    "https://canvaspro.app/checkout/return?session_id={CHECKOUT_SESSION_ID}",
  );
  assert.throws(() => assertSafeReturnUrl("https://canvaspro.app.evil.example/return"));
  assert.throws(() => assertSafeReturnUrl("http://canvaspro.app/return"));
  assert.throws(() => assertSafeReturnUrl("javascript:alert(1)"));
});

test("Stripe webhook verification accepts only a fresh valid signature", async () => {
  const secret = "whsec_test_only";
  process.env.PAYMENTS_LIVE_WEBHOOK_SECRET = secret;
  const body = JSON.stringify({ type: "customer.subscription.updated", data: { object: {} } });
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const signature = Buffer.from(signed).toString("hex");

  const event = await verifyWebhook(
    new Request("https://canvaspro.app/api/public/payments/webhook?env=live", {
      method: "POST",
      body,
      headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
    }),
    "live",
  );
  assert.equal(event.type, "customer.subscription.updated");

  await assert.rejects(() =>
    verifyWebhook(
      new Request("https://canvaspro.app/api/public/payments/webhook?env=live", {
        method: "POST",
        body,
        headers: { "stripe-signature": `t=${timestamp},v1=${"0".repeat(64)}` },
      }),
      "live",
    ),
  );
});
