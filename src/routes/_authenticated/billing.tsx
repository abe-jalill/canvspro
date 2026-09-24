import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { GlassCard } from "@/components/glass-card";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { StripeEmbeddedCheckoutForm } from "@/components/stripe-embedded-checkout";
import { useSubscription } from "@/lib/subscription";
import { CANVAS_PRO_PLANS, type CanvasProPlan } from "@/lib/stripe";
import { createPortalSession } from "@/utils/payments.functions";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Canvas Pro" },
      {
        name: "description",
        content:
          "Start with 10 days free, then $2.99 per month or $30 per year (save 17%) for your full class dashboard.",
      },
    ],
  }),
  component: BillingPage,
});

const FEATURES = [
  "Live Canvas grades, assignments, and announcements",
  "Focus view with 1-day to 1-week due windows",
  "Smart notifications and daily digest",
  "Calendar, class schedule, and workload heatmap",
];

function BillingPage() {
  const { subscription, isActive, isLoading } = useSubscription();
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CanvasProPlan>(CANVAS_PRO_PLANS[1]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  async function openHostedBilling() {
    await Browser.open({ url: "https://canvaspro.app/billing" });
  }

  async function openPortal() {
    setStatus(null);
    setBusy(true);
    // Open inside the click gesture so Safari does not block the portal tab.
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

  const renews = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          First 10 days free, then $2.99 per month or $30 per year — save 17% yearly. Cancel
          anytime.
        </p>
      </header>

      {!isNative && <PaymentTestModeBanner />}

      <GlassCard
        title="CanvasPro Pro"
        subtitle={
          isLoading
            ? "Loading subscription..."
            : isActive
              ? "Your subscription is active."
              : "Upgrade to CanvasPro Pro"
        }
      >
        <div className="flex w-full flex-col gap-4">
          {!isNative && (
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {FEATURES.map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your plan…</p>
          ) : isNative ? (
            <>
              {isActive && (
                <p className="text-sm text-muted-foreground">
                  Status: {subscription?.status}
                  {renews
                    ? subscription?.cancel_at_period_end
                      ? ` — access ends ${renews}`
                      : ` — renews ${renews}`
                    : ""}
                </p>
              )}
              <button
                type="button"
                onClick={openHostedBilling}
                className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background sm:w-auto"
              >
                {isActive ? "Manage subscription" : "Subscribe"}
              </button>
              <p className="text-xs text-muted-foreground">
                Billing is securely completed on canvaspro.app.
              </p>
            </>
          ) : isActive ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Status: {subscription?.status}
                {renews
                  ? subscription?.cancel_at_period_end
                    ? ` — access ends ${renews}`
                    : ` — renews ${renews}`
                  : ""}
              </p>
              <button
                type="button"
                onClick={openPortal}
                disabled={busy}
                className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 sm:w-auto"
              >
                {busy ? "Opening…" : "Manage subscription"}
              </button>
            </div>
          ) : showCheckout ? (
            <StripeEmbeddedCheckoutForm
              priceId={selectedPlan.id}
              returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                {CANVAS_PRO_PLANS.map((plan) => {
                  const active = selectedPlan.id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan)}
                      className={`glass-hover relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-sm ${
                        active ? "bg-foreground text-background" : "glass-inset text-foreground"
                      }`}
                    >
                      {"badge" in plan && plan.badge && (
                        <span className="absolute -top-2 right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {plan.badge}
                        </span>
                      )}
                      <span className="font-semibold">{plan.name}</span>
                      <span
                        className={active ? "text-xs opacity-80" : "text-xs text-muted-foreground"}
                      >
                        {plan.price} {plan.cadence}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowCheckout(true)}
                className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background sm:w-auto"
              >
                Start 10 days free — then {selectedPlan.price}
                {selectedPlan.cadence}
              </button>
            </div>
          )}

          {status && <p className="text-sm text-foreground/80">{status}</p>}
        </div>
      </GlassCard>
    </div>
  );
}
