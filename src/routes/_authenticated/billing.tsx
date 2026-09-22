import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard } from "@/components/glass-card";
import { useSubscription } from "@/lib/subscription";
import { createPortalSession } from "@/utils/payments.functions";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Canvas Pro" },
      { name: "description", content: "CanvasPro is free for everyone. Manage an existing subscription here." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { subscription, isActive, isLoading } = useSubscription();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function openPortal() {
    setStatus(null);
    setBusy(true);
    const portalTab = window.open("about:blank", "_blank");
    if (portalTab) {
      portalTab.opener = null;
      portalTab.document.title = "Opening billing portal…";
    }
    try {
      const result = await createPortalSession({ data: { returnUrl: window.location.href } });
      if ("error" in result) throw new Error(result.error);
      if (portalTab) portalTab.location.replace(result.url);
      else window.location.assign(result.url);
    } catch (error) {
      portalTab?.close();
      setStatus(error instanceof Error ? error.message : "Could not open the billing portal.");
    } finally {
      setBusy(false);
    }
  }

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : null;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CanvasPro is free for everyone. No subscription is needed to use any feature.
        </p>
      </header>
      <GlassCard title="Existing subscription" subtitle="New subscriptions are no longer offered.">
        <div className="flex w-full flex-col gap-4 text-sm text-muted-foreground">
          {isLoading ? (
            <p>Checking your billing history…</p>
          ) : subscription?.stripe_subscription_id ? (
            <>
              <p>
                Status: {subscription.status}
                {periodEnd
                  ? subscription.cancel_at_period_end
                    ? ` — scheduled to end ${periodEnd}`
                    : isActive
                      ? ` — next billing date ${periodEnd}`
                      : ` — period ended ${periodEnd}`
                  : ""}
              </p>
              <p>Your CanvasPro access stays free even if you cancel this subscription.</p>
              <button
                type="button"
                onClick={openPortal}
                disabled={busy}
                className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 sm:w-auto"
              >
                {busy ? "Opening…" : "Manage or cancel subscription"}
              </button>
            </>
          ) : (
            <p>You have no subscription to manage.</p>
          )}
          {status && <p className="text-foreground/80">{status}</p>}
        </div>
      </GlassCard>
    </div>
  );
}
