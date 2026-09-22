import { createFileRoute } from "@tanstack/react-router";
import { Browser } from "@capacitor/browser";
import { useState } from "react";
import { GlassCard } from "@/components/glass-card";
import { useSubscription } from "@/lib/subscription";
import { createMobileBillingUrl } from "@/lib/subscription.functions";
import { CANVAS_PRO_PLANS, type CanvasProPlan } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

function BillingPage() {
  const { subscription, isActive, isLoading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<CanvasProPlan>(CANVAS_PRO_PLANS[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renews = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  async function openBilling() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = await createMobileBillingUrl(
        isActive ? "portal" : "checkout",
        isActive ? undefined : selectedPlan.id,
      );
      await Browser.open({ url, presentationStyle: "popover" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open secure billing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your CanvasPro subscription.</p>
      </header>

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

          {!isLoading && !isActive && (
            <div className="grid grid-cols-2 gap-2">
              {CANVAS_PRO_PLANS.map((plan) => {
                const selected = selectedPlan.id === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`press relative min-h-14 rounded-xl px-3 py-2 text-sm ${
                      selected ? "bg-foreground text-background" : "glass-inset text-foreground"
                    }`}
                    aria-pressed={selected}
                  >
                    {"badge" in plan && plan.badge && (
                      <span className="absolute -top-2 right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {plan.badge}
                      </span>
                    )}
                    <span className="block font-semibold">{plan.name}</span>
                    <span
                      className={selected ? "text-xs opacity-80" : "text-xs text-muted-foreground"}
                    >
                      {plan.price}
                      {plan.cadence}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={openBilling}
            disabled={busy || isLoading}
            className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background sm:w-auto"
          >
            {busy
              ? "Opening secure billing…"
              : isActive
                ? "Manage subscription"
                : `Start 10 days free — then ${selectedPlan.price}${selectedPlan.cadence}`}
          </button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <p className="text-xs text-muted-foreground">
            Billing opens securely in Stripe. Return to CanvasPro when you finish and your access
            will refresh automatically.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
