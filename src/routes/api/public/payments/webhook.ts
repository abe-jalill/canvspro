import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env['SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    );
  }
  return _supabase;
}

function subscriptionsTable() {
  return getSupabase().from("subscriptions") as any;
}

function priceIdOf(item: any): string {
  return (
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id
  );
}

function isoOrNull(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/** Some Stripe flows don't copy checkout metadata onto the subscription;
 *  fall back to the customer id we already recorded for this account. */
async function userIdForCustomer(
  customerId: string,
  env: StripeEnv,
): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await subscriptionsTable()
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId =
    subscription.metadata?.userId ??
    (await userIdForCustomer(subscription.customer, env));
  if (!userId) {
    console.error(
      "No userId in subscription metadata and no matching customer:",
      subscription.id,
    );
    return;
  }
  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await subscriptionsTable()
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
        product_id: item?.price?.product,
        price_id: priceIdOf(item),
        status: subscription.status,
        current_period_start: isoOrNull(periodStart),
        current_period_end: isoOrNull(periodEnd),
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );

  await sendReceipt(userId, item, periodEnd);
}

async function sendReceipt(
  userId: string,
  item: any,
  periodEnd: number | null | undefined,
) {
  try {
    const { data } = await (getSupabase().auth as any).admin.getUserById(userId);
    const email = data?.user?.email as string | undefined;
    if (!email) return;

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const cents = item?.price?.unit_amount ?? null;
    const isYearly = priceIdOf(item) === "pro_yearly";
    await sendTemplateEmail("subscription-receipt", email, {
      templateData: {
        plan: isYearly ? "CanvasPro Yearly" : "CanvasPro Monthly",
        amount: cents != null ? `$${(cents / 100).toFixed(2)}` : "$2.99",
        renewsOn: periodEnd
          ? new Date(periodEnd * 1000).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : undefined,
        appUrl: "https://canvaspro.app",
      },
      idempotencyKey: `subscription-receipt-${userId}-${item?.id ?? "sub"}`,
    });
  } catch (error) {
    console.error("Receipt email failed:", error);
  }
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await subscriptionsTable()
    .update({
      status: subscription.status,
      product_id: item?.price?.product,
      price_id: priceIdOf(item),
      current_period_start: isoOrNull(periodStart),
      current_period_end: isoOrNull(periodEnd),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await subscriptionsTable()
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

/** A full refund revokes Pro immediately — access must not linger until the
 *  period end once the money has gone back. Partial refunds leave access. */
async function handleChargeRefunded(charge: any, env: StripeEnv) {
  if (!charge?.refunded) {
    console.log("Partial refund — access kept:", charge?.id);
    return;
  }
  const customerId = charge.customer as string | undefined;
  if (!customerId) {
    console.error("Refunded charge with no customer:", charge?.id);
    return;
  }
  const now = new Date().toISOString();
  const { data, error } = await subscriptionsTable()
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      current_period_end: now,
      updated_at: now,
    })
    .eq("stripe_customer_id", customerId)
    .eq("environment", env)
    .in("status", ["active", "trialing", "past_due"])
    .select("id");
  if (error) {
    console.error("Failed to revoke on refund:", error);
    throw error;
  }
  console.log(
    `Refund ${charge.id}: revoked ${data?.length ?? 0} subscription(s) instantly for customer ${customerId} (${env})`,
  );
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          // Misconfigured endpoint: fail loudly so Stripe retries and the
          // problem is visible, instead of silently dropping a paid event.
          console.error("Webhook received with invalid env:", rawEnv);
          return new Response("Missing or invalid env query parameter", { status: 400 });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
