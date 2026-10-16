// CoursePro's paid plan: prices, the trial, and what an account's billing
// state means. Pure (no imports) so the website, the webhook, the reminder
// job and the tests share one definition.

export type Plan = "monthly" | "yearly";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "paused" | "canceled";

/** Fired when the backend refuses Canvas data for lack of a subscription. */
export const BILLING_REQUIRED_EVENT = "canvaspro:billing-required";

export const TRIAL_DAYS = 14;
/** Paddle requires 14-90 days; CoursePro uses the minimum. */
export const REFUND_WINDOW_DAYS = 14;
/** Accounts from before the paywall get this many free days from launch. */
export const LAUNCH_GRACE_DAYS = 14;

export const PLANS: Record<Plan, { price: string; cents: number; per: "month" | "year" }> = {
  monthly: { price: "$5.00", cents: 500, per: "month" },
  yearly: { price: "$50.00", cents: 5000, per: "year" },
};

/** Which Paddle price a checkout uses: the trial ones start with 14 free days. */
/** One Paddle price per plan; both carry the free trial. */
export type PriceKey = Plan;

/** The signed-in account's billing, as `my_billing_status()` returns it. */
export interface BillingStatus {
  access: boolean;
  now: string;
  enforce_from: string | null;
  grace_ends_at: string | null;
  status: SubscriptionStatus | null;
  plan: Plan | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  trial_used: boolean;
  complimentary: boolean;
  has_subscription: boolean;
}

export type BillingState =
  /** The paywall hasn't started: everyone has access. */
  | "free"
  | "complimentary"
  | "trial"
  | "active"
  /** Paid until the period ends, then stops. */
  | "canceling"
  /** Paddle is retrying a failed card; access continues meanwhile. */
  | "past_due"
  /** An account from before launch, inside its free days. */
  | "grace"
  /** No access: subscribe to continue. */
  | "none";

const DAY_MS = 24 * 60 * 60 * 1000;

function time(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : null;
}

export function billingState(s: BillingStatus, now = Date.now()): BillingState {
  if (s.complimentary) return "complimentary";
  if (s.status === "trialing") return "trial";
  if (s.status === "past_due") return "past_due";
  if (s.status === "active") return s.cancel_at ? "canceling" : "active";
  const enforceFrom = time(s.enforce_from);
  if (enforceFrom === null || now < enforceFrom) return "free";
  const graceEnds = time(s.grace_ends_at);
  if (graceEnds !== null && now < graceEnds) return "grace";
  return "none";
}

/** "Oct 28" in the reader's time zone (or the one given). */
export function formatDay(iso: string | null | undefined, timeZone?: string): string {
  const value = time(iso);
  if (value === null) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
}

/** Whole days left until `iso`, never below 0. */
export function daysLeft(iso: string | null | undefined, now = Date.now()): number {
  const value = time(iso);
  if (value === null) return 0;
  return Math.max(0, Math.ceil((value - now) / DAY_MS));
}

export interface BillingCopy {
  state: BillingState;
  headline: string;
  detail: string;
}

/** What the banner and Settings → Billing say about the account. */
export function describeBilling(
  s: BillingStatus,
  now = Date.now(),
  timeZone?: string,
): BillingCopy {
  const state = billingState(s, now);
  const plan = s.plan ? PLANS[s.plan] : null;
  const charge = plan ? `${plan.price}/${plan.per}` : "";
  switch (state) {
    case "complimentary":
      return {
        state,
        headline: "CoursePro is on us",
        detail: "Your account has complimentary access.",
      };
    case "trial": {
      const day = formatDay(s.trial_ends_at, timeZone);
      return {
        state,
        headline: `Free trial · ${daysLeft(s.trial_ends_at, now)} days left`,
        detail: s.cancel_at
          ? `Your trial ends ${day} and you won't be charged.`
          : `You'll be charged ${charge} plus tax on ${day} unless you cancel before then.`,
      };
    }
    case "active":
      return {
        state,
        headline: `CoursePro ${s.plan === "yearly" ? "yearly" : "monthly"}`,
        detail: `Renews ${formatDay(s.current_period_end, timeZone)} at ${charge} plus tax.`,
      };
    case "canceling":
      return {
        state,
        headline: "Subscription canceled",
        detail: `You keep CoursePro until ${formatDay(s.cancel_at ?? s.current_period_end, timeZone)}. You won't be charged again.`,
      };
    case "past_due":
      return {
        state,
        headline: "Your last payment didn't go through",
        detail: "Update your payment method to keep CoursePro.",
      };
    case "grace":
      return {
        state,
        headline: `${daysLeft(s.grace_ends_at, now)} free days left`,
        detail: `CoursePro is now a paid app. Your free access ends ${formatDay(s.grace_ends_at, timeZone)}. Subscribe to keep your dashboard, reminders and widgets.`,
      };
    case "free":
      return { state, headline: "CoursePro", detail: "" };
    default:
      return {
        state,
        headline: "Subscribe to keep using CoursePro",
        detail: `Start a ${TRIAL_DAYS}-day free trial. Cancel anytime before it ends and you won't be charged.`,
      };
  }
}

/**
 * Which price a new checkout uses: the plan's one price. Both prices carry the
 * 14-day trial in Paddle, so every checkout starts with it. Accounts from
 * before launch that subscribe inside their free days have the first charge
 * moved to the day those days end (`firstChargeForGrace`).
 */
export function checkoutPriceKey(input: { plan: Plan }): PriceKey {
  return input.plan;
}

/**
 * For an account from before launch that subscribed inside its free days: the
 * date its trial should end so the first charge lands when those days run out.
 * Null when nothing needs moving (no free days, already past them, or the
 * trial already ends first).
 */
export function firstChargeForGrace(
  trialEndsAt: string | null,
  graceEndsAt: string | null,
  now = Date.now(),
): string | null {
  const trialEnds = time(trialEndsAt);
  const graceEnds = time(graceEndsAt);
  if (trialEnds === null || graceEnds === null) return null;
  // Paddle needs the new date to be in the future; leave a little room.
  if (graceEnds <= now + 60 * 60 * 1000 || graceEnds >= trialEnds) return null;
  return new Date(graceEnds).toISOString();
}

/** The parts of a Paddle subscription entity CoursePro reads. */
export interface PaddleSubscription {
  id: string;
  status: string;
  customer_id: string;
  custom_data?: { user_id?: unknown } | null;
  next_billed_at?: string | null;
  current_billing_period?: { starts_at?: string; ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
  items?: Array<{
    price?: { id?: string; billing_cycle?: { interval?: string } | null } | null;
    trial_dates?: { starts_at?: string; ends_at?: string } | null;
  }>;
}

const STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due", "paused", "canceled"];

/** The `billing_accounts` columns a subscription event sets. */
export function billingRowFromSubscription(sub: PaddleSubscription, occurredAt: string) {
  const item = sub.items?.[0];
  const status = (STATUSES as string[]).includes(sub.status)
    ? (sub.status as SubscriptionStatus)
    : null;
  const hadTrial = status === "trialing" || Boolean(item?.trial_dates?.ends_at);
  return {
    paddle_customer_id: sub.customer_id,
    paddle_subscription_id: sub.id,
    status,
    price_id: item?.price?.id ?? null,
    plan: (item?.price?.billing_cycle?.interval === "year" ? "yearly" : "monthly") as Plan,
    trial_ends_at:
      status === "trialing" ? (item?.trial_dates?.ends_at ?? sub.next_billed_at ?? null) : null,
    current_period_end: sub.current_billing_period?.ends_at ?? sub.next_billed_at ?? null,
    cancel_at:
      sub.scheduled_change?.action === "cancel"
        ? (sub.scheduled_change.effective_at ?? null)
        : null,
    last_event_at: occurredAt,
    ...(hadTrial ? { trial_used: true } : {}),
  };
}

/** The account a subscription belongs to, from the checkout's custom data. */
export function userIdFromSubscription(sub: PaddleSubscription): string | null {
  const id = sub.custom_data?.user_id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/** True when `incoming` is not older than the last event applied. */
export function isNewerEvent(incoming: string, lastApplied: string | null | undefined): boolean {
  const next = time(incoming);
  const last = time(lastApplied);
  if (next === null) return false;
  return last === null || next >= last;
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Checks a `Paddle-Signature` header ("ts=…;h1=…"): an HMAC-SHA256 of
 * "<ts>:<raw body>" with the notification's secret, sent within 5 minutes.
 */
export async function verifyPaddleSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  now = Date.now(),
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(";").map((part) => part.trim().split("="));
  const ts = parts.find(([key]) => key === "ts")?.[1];
  const signatures = parts.filter(([key]) => key === "h1").map(([, value]) => value ?? "");
  if (!ts || !/^\d+$/.test(ts) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(ts)) > toleranceSeconds) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${ts}:${rawBody}`)));
  return signatures.some((signature) => sameText(signature, expected));
}

/** Card-network rule: remind at least 7 days before a free trial's first charge. */
export const TRIAL_REMINDER_DAYS = 7;
/** Yearly renewals are announced 30 days ahead (California asks for 15-45). */
export const RENEWAL_REMINDER_DAYS = 30;
/** Accounts from before launch hear 3 days before their free days end. */
export const GRACE_REMINDER_DAYS = 3;

/** The reminder job runs hourly; this slack keeps "at least N days" true. */
const REMINDER_SLACK_MS = 2 * 60 * 60 * 1000;

function dueWithin(iso: string | null | undefined, days: number, now: number, slack = 0): boolean {
  const at = time(iso);
  if (at === null) return false;
  return at > now && at - now <= days * DAY_MS + slack;
}

export interface ReminderRow {
  status: string | null;
  plan: Plan | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  trial_reminder_sent_at: string | null;
  renewal_reminder_for: string | null;
}

/** A trial that will charge in about a week and hasn't been reminded. */
export function trialReminderDue(row: ReminderRow, now = Date.now()): boolean {
  return (
    row.status === "trialing" &&
    !row.cancel_at &&
    !row.trial_reminder_sent_at &&
    dueWithin(row.trial_ends_at, TRIAL_REMINDER_DAYS, now, REMINDER_SLACK_MS)
  );
}

/** A yearly plan renewing within 30 days, not yet reminded for this renewal. */
export function renewalReminderDue(row: ReminderRow, now = Date.now()): boolean {
  if (row.status !== "active" || row.plan !== "yearly" || row.cancel_at) return false;
  if (!dueWithin(row.current_period_end, RENEWAL_REMINDER_DAYS, now)) return false;
  return time(row.renewal_reminder_for) !== time(row.current_period_end);
}

/** An account from before launch, 3 days from the end of its free days, not subscribed. */
export function graceReminderDue(input: {
  graceEndsAt: string | null;
  sentAt: string | null;
  subscribed: boolean;
  now?: number;
}): boolean {
  return (
    !input.subscribed &&
    !input.sentAt &&
    dueWithin(input.graceEndsAt, GRACE_REMINDER_DAYS, input.now ?? Date.now())
  );
}

/** Signed-in pages that stay open without access: billing, account (and deletion). */
export const PAYWALL_ALLOWED_PATHS = ["/settings", "/settings/billing", "/settings/account"];

export function isPaywallAllowed(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return PAYWALL_ALLOWED_PATHS.includes(path);
}
