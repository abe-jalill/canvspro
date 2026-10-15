// Signed-in billing actions. Every Paddle call happens on the server with the
// account taken from the verified session, never from the browser.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { billingRowFromSubscription, checkoutPriceKey, type Plan } from "@/lib/billing";

const LIVE_STATUSES = new Set(["trialing", "active", "past_due"]);

function planInput(input: unknown): { plan: Plan } {
  const plan = (input as { plan?: unknown } | null)?.plan;
  if (plan !== "monthly" && plan !== "yearly") throw new Error("Choose monthly or yearly.");
  return { plan };
}

function confirmInput(input: unknown): { confirm: boolean } {
  return { confirm: (input as { confirm?: unknown } | null)?.confirm === true };
}

/** Columns from Paddle's reply to an action; the webhook's event order stays authoritative. */
function rowFromReply(sub: Parameters<typeof billingRowFromSubscription>[0]) {
  const { last_event_at: _ignored, ...row } = billingRowFromSubscription(
    sub,
    new Date().toISOString(),
  );
  return row;
}

function money(minor: string | undefined, currency: string | undefined): string | null {
  const amount = Number(minor);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(
    amount / 100,
  );
}

async function liveSubscription(userId: string) {
  const { readBillingRow } = await import("@/lib/billing.server");
  const row = await readBillingRow(userId);
  if (!row?.paddle_subscription_id || !row.status || !LIVE_STATUSES.has(row.status)) {
    throw new Error("You don't have an active subscription.");
  }
  return row as typeof row & { paddle_subscription_id: string };
}

/** Starts a Paddle checkout; the browser opens it by transaction id. */
export const startCheckoutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(planInput)
  .handler(async ({ context, data }) => {
    const { accountBasics, graceEndsAt, readBillingRow, readEnforceFrom, saveBillingRow } =
      await import("@/lib/billing.server");
    const paddle = await import("@/lib/paddle.server");
    const [account, row, enforceFrom] = await Promise.all([
      accountBasics(context.userId),
      readBillingRow(context.userId),
      readEnforceFrom(),
    ]);
    if (!account.email) throw new Error("Add an email address to your account first.");
    if (row?.status && LIVE_STATUSES.has(row.status)) {
      throw new Error("You already have a subscription. Manage it in Settings → Billing.");
    }
    const priceKey = checkoutPriceKey({
      plan: data.plan,
      trialUsed: row?.trial_used ?? false,
      graceEndsAt: graceEndsAt(account.createdAt, enforceFrom),
    });
    const customerId = row?.paddle_customer_id ?? (await paddle.customerIdForEmail(account.email));
    await saveBillingRow(context.userId, {
      paddle_customer_id: customerId,
      environment: paddle.paddleEnvironment(),
    });
    const transactionId = await paddle.createCheckoutTransaction({
      customerId,
      priceId: paddle.paddlePriceId(priceKey),
      userId: context.userId,
    });
    return { transactionId, trial: priceKey.endsWith("_trial") };
  });

/**
 * Monthly → yearly. Without `confirm` it only returns what Paddle would charge
 * now; with it, the change is made. In a trial nothing is charged until the
 * trial ends; otherwise the unused month is credited against the year.
 */
export const switchToYearlyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(confirmInput)
  .handler(async ({ context, data }) => {
    const paddle = await import("@/lib/paddle.server");
    const { saveBillingRow } = await import("@/lib/billing.server");
    const row = await liveSubscription(context.userId);
    if (row.plan === "yearly") throw new Error("You're already on the yearly plan.");
    const trialing = row.status === "trialing";
    const change = {
      items: [
        { price_id: paddle.paddlePriceId(trialing ? "yearly_trial" : "yearly"), quantity: 1 },
      ],
      proration_billing_mode: trialing
        ? ("do_not_bill" as const)
        : ("prorated_immediately" as const),
    };
    if (!data.confirm) {
      const preview = await paddle.previewSubscriptionChange(row.paddle_subscription_id, change);
      const totals = preview.immediate_transaction?.details?.totals;
      return {
        applied: false,
        chargeNow: trialing ? null : money(totals?.grand_total, totals?.currency_code),
      };
    }
    const updated = await paddle.updateSubscription(row.paddle_subscription_id, change);
    await saveBillingRow(context.userId, rowFromReply(updated));
    return { applied: true, chargeNow: null };
  });

/** Cancels at the end of the current period; access continues until then. */
export const cancelSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const paddle = await import("@/lib/paddle.server");
    const { saveBillingRow } = await import("@/lib/billing.server");
    const row = await liveSubscription(context.userId);
    const updated = await paddle.cancelAtPeriodEnd(row.paddle_subscription_id);
    await saveBillingRow(context.userId, rowFromReply(updated));
    return { ok: true };
  });

/** Undoes a scheduled cancellation. */
export const resumeSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const paddle = await import("@/lib/paddle.server");
    const { saveBillingRow } = await import("@/lib/billing.server");
    const row = await liveSubscription(context.userId);
    const updated = await paddle.updateSubscription(row.paddle_subscription_id, {
      scheduled_change: null,
    });
    await saveBillingRow(context.userId, rowFromReply(updated));
    return { ok: true };
  });

/** A Paddle-hosted page for the payment method, invoices and receipts. */
export const billingPortalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const paddle = await import("@/lib/paddle.server");
    const { readBillingRow } = await import("@/lib/billing.server");
    const row = await readBillingRow(context.userId);
    if (!row?.paddle_customer_id) throw new Error("No billing history yet.");
    const url = await paddle.customerPortalUrl(
      row.paddle_customer_id,
      row.paddle_subscription_id ?? undefined,
    );
    return { url };
  });
