import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/glass-card";
import { isPaymentsConfigured } from "@/lib/stripe";
import { useSubscription } from "@/lib/subscription";

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
  const configured = isPaymentsConfigured();

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
          Canvas Pro is $2.99 per month. Cancel anytime.
        </p>
      </header>

      <GlassCard
        title="Canvas Pro"
        subtitle={isActive ? "Your subscription is active." : "$2.99 / month"}
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
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
              <p className="text-sm text-foreground/90">
                Payments are being reset. The new checkout setup will appear here once the
                Stripe integration is re-enabled.
              </p>
            </div>
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
              <p className="text-xs text-muted-foreground">
                Manage your subscription from the billing portal (available once checkout is
                wired up).
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Subscribe to unlock every Pro feature. The checkout form will be restored after
              the new product is created.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
