import { createFileRoute } from "@tanstack/react-router";
import { Browser } from "@capacitor/browser";
import { GlassCard } from "@/components/glass-card";
import { useSubscription } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

function BillingPage() {
  const { subscription, isActive, isLoading } = useSubscription();

  const renews = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  async function openBilling() {
    await Browser.open({
      url: "https://canvaspro.app/billing",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Billing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your CanvasPro subscription.
        </p>
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

          <button
            type="button"
            onClick={openBilling}
            className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background sm:w-auto"
          >
            {isActive ? "Manage subscription" : "Subscribe"}
          </button>

          <p className="text-xs text-muted-foreground">
            Billing is securely completed on canvaspro.app.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}