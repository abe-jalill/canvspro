import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/glass-card";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { StripeEmbeddedCheckout } from "@/components/stripe-embedded-checkout";
import { CANVAS_PRO_PLANS, isPaymentsConfigured } from "@/lib/stripe";

type CheckoutSearch = { plan: "pro_monthly" | "pro_yearly" };

export const Route = createFileRoute("/_authenticated/checkout/")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    plan: search["plan"] === "pro_yearly" ? "pro_yearly" : "pro_monthly",
  }),
  head: () => ({
    meta: [
      { title: "Checkout — Canvas Pro" },
      {
        name: "description",
        content:
          "Complete your Canvas Pro purchase securely and unlock grades, assignments, focus windows, and smart notifications.",
      },
      { property: "og:title", content: "Checkout — Canvas Pro" },
      {
        property: "og:description",
        content: "Secure checkout for Canvas Pro — monthly or yearly, cancel anytime.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { plan: planId } = Route.useSearch();
  const plan = CANVAS_PRO_PLANS.find((p) => p.priceId === planId) ?? CANVAS_PRO_PLANS[0]!;
  const configured = isPaymentsConfigured();

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5 overflow-x-hidden">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Canvas Pro {plan.label} — {plan.price} {plan.cadence}. Cancel anytime.
        </p>
      </header>

      <PaymentTestModeBanner />

      <GlassCard title="Your plan" subtitle={`${plan.price} ${plan.cadence}`}>
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {CANVAS_PRO_PLANS.map((p) => (
              <Link
                key={p.priceId}
                to="/checkout"
                search={{ plan: p.priceId }}
                aria-current={p.priceId === plan.priceId ? "true" : undefined}
                className={`flex min-h-11 items-center rounded-xl border px-4 text-sm transition ${
                  p.priceId === plan.priceId
                    ? "border-foreground/40 bg-foreground/10 font-medium"
                    : "border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06]"
                }`}
              >
                {p.label} — {p.price} {p.cadence}
              </Link>
            ))}
          </div>

          {configured ? (
            <StripeEmbeddedCheckout
              priceId={plan.priceId}
              returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Checkout isn't available in this build yet.
            </p>
          )}

          <Link
            to="/billing"
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            Manage billing instead
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
