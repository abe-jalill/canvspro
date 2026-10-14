import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  billingRowFromSubscription,
  billingState,
  checkoutPriceKey,
  describeBilling,
  firstChargeForGrace,
  graceReminderDue,
  isNewerEvent,
  isPaywallAllowed,
  PLANS,
  REFUND_WINDOW_DAYS,
  renewalReminderDue,
  trialReminderDue,
  TRIAL_DAYS,
  userIdFromSubscription,
  verifyPaddleSignature,
} from "../src/lib/billing.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const DAY = 86_400_000;
const NOW = Date.parse("2026-11-01T12:00:00Z");
const iso = (offsetDays) => new Date(NOW + offsetDays * DAY).toISOString();

const status = (overrides = {}) => ({
  access: true,
  now: iso(0),
  enforce_from: iso(-1),
  grace_ends_at: null,
  status: null,
  plan: null,
  trial_ends_at: null,
  current_period_end: null,
  cancel_at: null,
  trial_used: false,
  complimentary: false,
  has_subscription: false,
  ...overrides,
});

test("prices are $5.00 a month and $50.00 a year, with a 14-day trial and 14-day refunds", () => {
  assert.deepEqual(PLANS.monthly, { price: "$5.00", cents: 500, per: "month" });
  assert.deepEqual(PLANS.yearly, { price: "$50.00", cents: 5000, per: "year" });
  assert.equal(TRIAL_DAYS, 14);
  assert.equal(REFUND_WINDOW_DAYS, 14);
});

test("each account's billing state", () => {
  assert.equal(billingState(status({ enforce_from: null }), NOW), "free");
  assert.equal(billingState(status({ enforce_from: iso(2) }), NOW), "free");
  assert.equal(billingState(status({ complimentary: true }), NOW), "complimentary");
  assert.equal(billingState(status({ status: "trialing" }), NOW), "trial");
  assert.equal(billingState(status({ status: "active" }), NOW), "active");
  assert.equal(billingState(status({ status: "active", cancel_at: iso(10) }), NOW), "canceling");
  assert.equal(billingState(status({ status: "past_due" }), NOW), "past_due");
  assert.equal(billingState(status({ grace_ends_at: iso(5) }), NOW), "grace");
  assert.equal(billingState(status({ grace_ends_at: iso(-1) }), NOW), "none");
  assert.equal(billingState(status({ status: "canceled" }), NOW), "none");
});

test("billing copy states the charge, the date and how to avoid it", () => {
  const trial = describeBilling(
    status({ status: "trialing", plan: "monthly", trial_ends_at: iso(10) }),
    NOW,
    "UTC",
  );
  assert.equal(trial.headline, "Free trial · 10 days left");
  assert.equal(
    trial.detail,
    "You'll be charged $5.00/month plus tax on Nov 11 unless you cancel before then.",
  );
  const canceling = describeBilling(
    status({ status: "active", plan: "yearly", cancel_at: iso(20), current_period_end: iso(20) }),
    NOW,
    "UTC",
  );
  assert.match(canceling.detail, /You keep CanvasPro until Nov 21\. You won't be charged again\./);
  const grace = describeBilling(status({ grace_ends_at: iso(3) }), NOW, "UTC");
  assert.match(grace.detail, /free access ends Nov 4/);
  assert.match(
    describeBilling(status({ trial_used: true, grace_ends_at: iso(-2) }), NOW).detail,
    /trial has ended/,
  );
});

test("checkout price: one trial per account; launch accounts use their free days instead", () => {
  assert.equal(
    checkoutPriceKey({ plan: "monthly", trialUsed: false, graceEndsAt: null, now: NOW }),
    "monthly_trial",
  );
  assert.equal(
    checkoutPriceKey({ plan: "yearly", trialUsed: true, graceEndsAt: null, now: NOW }),
    "yearly",
  );
  assert.equal(
    checkoutPriceKey({ plan: "monthly", trialUsed: false, graceEndsAt: iso(4), now: NOW }),
    "monthly_trial",
  );
  assert.equal(
    checkoutPriceKey({ plan: "monthly", trialUsed: false, graceEndsAt: iso(-1), now: NOW }),
    "monthly",
  );
});

test("a launch account's first charge moves to the end of its free days, never later than the trial", () => {
  assert.equal(firstChargeForGrace(iso(14), iso(5), NOW), iso(5));
  assert.equal(firstChargeForGrace(iso(14), iso(20), NOW), null);
  assert.equal(firstChargeForGrace(iso(14), iso(0.01), NOW), null);
  assert.equal(firstChargeForGrace(iso(14), null, NOW), null);
});

test("Paddle subscription events map to billing rows", () => {
  const sub = {
    id: "sub_1",
    status: "trialing",
    customer_id: "ctm_1",
    custom_data: { user_id: "11111111-2222-3333-4444-555555555555" },
    next_billed_at: iso(14),
    current_billing_period: { starts_at: iso(0), ends_at: iso(14) },
    scheduled_change: null,
    items: [
      {
        price: { id: "pri_y", billing_cycle: { interval: "year" } },
        trial_dates: { starts_at: iso(0), ends_at: iso(14) },
      },
    ],
  };
  const row = billingRowFromSubscription(sub, iso(0));
  assert.equal(row.status, "trialing");
  assert.equal(row.plan, "yearly");
  assert.equal(row.trial_ends_at, iso(14));
  assert.equal(row.trial_used, true);
  assert.equal(row.cancel_at, null);
  assert.equal(userIdFromSubscription(sub), "11111111-2222-3333-4444-555555555555");

  const canceling = billingRowFromSubscription(
    {
      ...sub,
      status: "active",
      items: [{ price: { id: "pri_m", billing_cycle: { interval: "month" } } }],
      scheduled_change: { action: "cancel", effective_at: iso(30) },
    },
    iso(1),
  );
  assert.equal(canceling.plan, "monthly");
  assert.equal(canceling.cancel_at, iso(30));
  assert.equal(canceling.trial_ends_at, null);
  assert.equal(
    "trial_used" in canceling,
    false,
    "an event without a trial never clears trial_used",
  );
  assert.equal(billingRowFromSubscription({ ...sub, status: "weird" }, iso(0)).status, null);
  assert.equal(userIdFromSubscription({ ...sub, custom_data: { user_id: "not-an-id" } }), null);
});

test("older webhook events never overwrite newer ones", () => {
  assert.equal(isNewerEvent(iso(1), iso(0)), true);
  assert.equal(isNewerEvent(iso(0), iso(1)), false);
  assert.equal(isNewerEvent(iso(0), null), true);
  assert.equal(isNewerEvent("garbage", null), false);
});

test("Paddle signatures: valid, tampered, stale and malformed", async () => {
  const secret = "pdl_ntfset_test_secret";
  const body = JSON.stringify({ event_type: "subscription.created" });
  const ts = Math.floor(NOW / 1000);
  const h1 = createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
  assert.equal(await verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, secret, NOW), true);
  assert.equal(await verifyPaddleSignature(`${body} `, `ts=${ts};h1=${h1}`, secret, NOW), false);
  assert.equal(await verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, "other-secret", NOW), false);
  assert.equal(
    await verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, secret, NOW + 10 * 60_000),
    false,
  );
  assert.equal(await verifyPaddleSignature(body, `h1=${h1}`, secret, NOW), false);
  assert.equal(await verifyPaddleSignature(body, null, secret, NOW), false);
  assert.equal(await verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, "", NOW), false);
  // Paddle may send more than one signature while a secret rotates.
  assert.equal(
    await verifyPaddleSignature(body, `ts=${ts};h1=deadbeef;h1=${h1}`, secret, NOW),
    true,
  );
});

test("reminders: 7 days before a trial charge, 30 days before a yearly renewal, 3 days before free days end", () => {
  const base = {
    plan: "monthly",
    current_period_end: null,
    cancel_at: null,
    trial_reminder_sent_at: null,
    renewal_reminder_for: null,
  };
  assert.equal(trialReminderDue({ ...base, status: "trialing", trial_ends_at: iso(7) }, NOW), true);
  assert.equal(
    trialReminderDue({ ...base, status: "trialing", trial_ends_at: iso(9) }, NOW),
    false,
  );
  assert.equal(
    trialReminderDue(
      { ...base, status: "trialing", trial_ends_at: iso(7), trial_reminder_sent_at: iso(-1) },
      NOW,
    ),
    false,
  );
  assert.equal(
    trialReminderDue(
      { ...base, status: "trialing", trial_ends_at: iso(7), cancel_at: iso(7) },
      NOW,
    ),
    false,
  );

  const yearly = {
    ...base,
    status: "active",
    plan: "yearly",
    trial_ends_at: null,
    current_period_end: iso(29),
  };
  assert.equal(renewalReminderDue(yearly, NOW), true);
  assert.equal(renewalReminderDue({ ...yearly, renewal_reminder_for: iso(29) }, NOW), false);
  assert.equal(renewalReminderDue({ ...yearly, current_period_end: iso(40) }, NOW), false);
  assert.equal(renewalReminderDue({ ...yearly, plan: "monthly" }, NOW), false);

  assert.equal(
    graceReminderDue({ graceEndsAt: iso(2.5), sentAt: null, subscribed: false, now: NOW }),
    true,
  );
  assert.equal(
    graceReminderDue({ graceEndsAt: iso(2.5), sentAt: null, subscribed: true, now: NOW }),
    false,
  );
  assert.equal(
    graceReminderDue({ graceEndsAt: iso(6), sentAt: null, subscribed: false, now: NOW }),
    false,
  );
});

test("without access only billing and account settings stay open", () => {
  for (const path of ["/settings", "/settings/", "/settings/billing", "/settings/account"]) {
    assert.equal(isPaywallAllowed(path), true, path);
  }
  for (const path of ["/dashboard", "/settings/canvas", "/assignments", "/settings/billing-fake"]) {
    assert.equal(isPaywallAllowed(path), false, path);
  }
});

test("the backend enforces access and push only checks accounts that have it", () => {
  const migration = read("drizzle/migrations/0013_paddle_billing.sql");
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.has_canvaspro_access\(user_uuid uuid\)/,
  );
  assert.match(migration, /interval '14 days'/);
  assert.match(migration, /b\.status IN \('trialing', 'active', 'past_due'\)/);
  // Users can read but never write their own billing row.
  assert.match(
    migration,
    /CREATE POLICY "own billing account" ON public\.billing_accounts\s+FOR SELECT/,
  );
  assert.doesNotMatch(migration, /billing_accounts[\s\S]{0,80}FOR (INSERT|UPDATE|ALL)/);
  // Push dispatch keeps its name, URL and 30-minute schedule.
  assert.match(migration, /'canvaspro-push-dispatch',\s+'\*\/30 10-23,0-3 \* \* \*'/);
  assert.match(migration, /https:\/\/canvaspro\.app\/api\/public\/push\/dispatch/);
  assert.match(migration, /WHERE public\.has_canvaspro_access\(user_id\)/);
  const journal = JSON.parse(read("drizzle/migrations/meta/_journal.json"));
  assert.ok(journal.entries.some((entry) => entry.tag === "0013_paddle_billing"));

  const canvas = read("supabase/functions/canvas/index.ts");
  assert.match(canvas, /rpc\/has_canvaspro_access/);
  assert.match(canvas, /message === "SUBSCRIPTION_REQUIRED"\s+\? 402/);
  // The webhook refuses unsigned requests; checkout ties the account from the session.
  assert.match(
    read("src/routes/api/public/paddle/webhook.ts"),
    /if \(!valid\) return new Response\("Invalid signature", \{ status: 400 \}\)/,
  );
  assert.match(read("src/lib/billing.functions.ts"), /userId: context\.userId/);
  // Deleting an account cancels its subscription first.
  assert.match(read("src/lib/account-deletion.server.ts"), /cancelBillingForDeletion\(userId\)/);
});

test("legal pages pass Paddle's review: merchant of record, a 14-day refund window, no banned wording", () => {
  const terms = read("src/routes/terms.tsx");
  const refunds = read("src/routes/refund-policy.tsx");
  const privacy = read("src/routes/privacy.tsx");
  const mor =
    "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders.";
  assert.ok(terms.includes(mor));
  assert.ok(refunds.includes(mor));
  assert.match(privacy, /Paddle\.com, our online reseller and Merchant of Record/);
  assert.match(terms, /within \$\{REFUND_WINDOW_DAYS\} days of a charge/);
  assert.match(refunds, /within \$\{REFUND_WINDOW_DAYS\} days of the date you were charged/);
  for (const [name, text] of [
    ["terms", terms],
    ["refunds", refunds],
    ["privacy", privacy],
  ]) {
    assert.doesNotMatch(text, /no refunds|all sales are final/i, name);
  }
  // Free claims are gone from the public pages.
  for (const page of [
    "src/routes/index.tsx",
    "src/routes/canvas-dashboard-guide.tsx",
    "src/routes/canvas-grade-calculator.tsx",
  ]) {
    assert.doesNotMatch(read(page), /100% free|Free for students|no subscription required/i, page);
  }
});
