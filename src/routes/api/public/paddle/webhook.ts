import { createFileRoute } from "@tanstack/react-router";
import {
  billingRowFromSubscription,
  firstChargeForGrace,
  isNewerEvent,
  userIdFromSubscription,
  verifyPaddleSignature,
  type PaddleSubscription,
} from "@/lib/billing";

const LIVE = new Set(["trialing", "active", "past_due"]);

interface PaddleEvent {
  event_type?: string;
  occurred_at?: string;
  data?: PaddleSubscription;
}

/**
 * Paddle notifications: keeps billing_accounts in step with each subscription.
 * Only signed requests are applied; older events never overwrite newer ones.
 * A 5xx makes Paddle retry, so storage failures are reported as such.
 */
async function handle(event: PaddleEvent): Promise<Response> {
  const sub = event.data;
  if (!event.event_type?.startsWith("subscription.") || !sub?.id || !event.occurred_at) {
    return Response.json({ ok: true, ignored: true });
  }
  const { billingDb, readBillingRow, saveBillingRow, accountBasics, readEnforceFrom, graceEndsAt } =
    await import("@/lib/billing.server");

  let userId = userIdFromSubscription(sub);
  if (!userId) {
    const db = await billingDb();
    const { data } = await db
      .from("billing_accounts")
      .select("user_id")
      .eq("paddle_customer_id", sub.customer_id)
      .limit(1)
      .maybeSingle();
    userId = (data?.user_id as string | undefined) ?? null;
  }
  if (!userId) {
    console.error("[paddle] no account for subscription", sub.id);
    return Response.json({ ok: true, ignored: true });
  }

  const current = await readBillingRow(userId);
  if (!isNewerEvent(event.occurred_at, current?.last_event_at)) {
    return Response.json({ ok: true, stale: true });
  }
  // A late event from an older subscription never replaces a live newer one.
  if (
    current?.paddle_subscription_id &&
    current.paddle_subscription_id !== sub.id &&
    current.status &&
    LIVE.has(current.status) &&
    !LIVE.has(sub.status)
  ) {
    return Response.json({ ok: true, superseded: true });
  }

  const row = billingRowFromSubscription(sub, event.occurred_at);
  const { paddleEnvironment } = await import("@/lib/paddle.server");
  await saveBillingRow(userId, { ...row, environment: paddleEnvironment() });

  // Accounts from before launch: the first charge waits until their free days end.
  if (event.event_type === "subscription.created" && row.status === "trialing") {
    const [account, enforceFrom] = await Promise.all([accountBasics(userId), readEnforceFrom()]);
    const chargeOn = firstChargeForGrace(
      row.trial_ends_at,
      graceEndsAt(account.createdAt, enforceFrom),
    );
    if (chargeOn) {
      const { updateSubscription } = await import("@/lib/paddle.server");
      await updateSubscription(sub.id, {
        next_billed_at: chargeOn,
        proration_billing_mode: "do_not_bill",
      });
    }
  }
  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/public/paddle/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const secret = process.env.PADDLE_WEBHOOK_SECRET ?? "";
        const valid = await verifyPaddleSignature(
          raw,
          request.headers.get("paddle-signature"),
          secret,
        );
        if (!valid) return new Response("Invalid signature", { status: 400 });
        let event: PaddleEvent;
        try {
          event = JSON.parse(raw) as PaddleEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        try {
          return await handle(event);
        } catch (err) {
          console.error("[paddle] webhook failed", err);
          return new Response("Could not apply event", { status: 500 });
        }
      },
    },
  },
});
