import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass-card";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { StripeEmbeddedCheckout } from "@/components/stripe-embedded-checkout";
import {
  CANVAS_PRO_PLANS,
  type CanvasProPlan,
  getStripeEnvironment,
  isPaymentsConfigured,
} from "@/lib/stripe";
import { useSubscription } from "@/lib/subscription";
import { createPortalSession } from "@/utils/payments.functions";


export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Canvas Pro" },
      {
        name: "description",
        content:
          "Manage your Canvas Pro subscription — $2.99 per month for your full class dashboard.",
      },
      { property: "og:title", content: "Billing — Canvas Pro" },
      {
        property: "og:description",
        content:
          "Manage your Canvas Pro subscription — $2.99 per month for your full class dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CanvasProPlan>(CANVAS_PRO_PLANS[0]!);

  const [portalBusy, setPortalBusy] = useState(false);
  const configured = isPaymentsConfigured();

  const renews = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  async function openPortal() {
    setPortalBusy(true);
    try {
      const result = await createPortalSession({
        data: {
          returnUrl: `${window.location.origin}/billing`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't open billing portal");
    } finally {
      setPortalBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-full flex-col gap-5 overflow-x-hidden">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Canvas Pro is $2.99/month or $24.99/year. Cancel anytime.
        </p>
      </header>

      <PaymentTestModeBanner />

      <GlassCard
        title="Canvas Pro"
        subtitle={isActive ? "Your subscription is active." : "Pick a plan"}
      >
        <div className="flex w-full flex-col gap-4">
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {FEATURES.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your plan…</p>
          ) : !configured ? (
            <p className="text-sm text-muted-foreground">
              Checkout isn't available in this build yet.
            </p>
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
              {subscription?.price_id !== "comped" ? (
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={portalBusy}
                  className="min-h-11 w-full rounded-xl border border-foreground/15 bg-foreground/[0.06] px-4 text-sm font-medium transition hover:bg-foreground/10 disabled:opacity-60 sm:w-auto"
                >
                  {portalBusy ? "Opening…" : "Manage subscription"}
                </button>
              ) : null}
              {subscription?.price_id === "pro_monthly" ? (
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={portalBusy}
                  className="min-h-11 w-full rounded-xl border border-foreground/15 px-4 text-sm font-medium transition hover:bg-foreground/[0.06] disabled:opacity-60 sm:w-auto"
                >
                  Switch to yearly — $24.99/yr (about 2 months free)
                </button>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Switching between monthly and yearly, or canceling, happens in the billing
                portal. Canceling keeps Pro until the end of the period you already paid for.
              </p>

            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {CANVAS_PRO_PLANS.map((plan) => {
                  const active = plan.priceId === selectedPlan.priceId;
                  return (
                    <button
                      key={plan.priceId}
                      type="button"
                      onClick={() => setSelectedPlan(plan)}
                      aria-pressed={active}
                      className={`flex min-h-16 flex-col items-start rounded-xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-foreground/40 bg-foreground/10"
                          : "border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06]"
                      }`}
                    >
                      <span className="text-sm font-medium">{plan.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {plan.price} {plan.cadence}
                      </span>
                      {plan.note ? (
                        <span className="mt-0.5 text-xs text-muted-foreground">
                          {plan.note}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <Link
                to="/checkout"
                search={{ plan: selectedPlan.priceId }}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90 sm:w-auto"
              >
                Subscribe — {selectedPlan.price} {selectedPlan.cadence}
              </Link>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

