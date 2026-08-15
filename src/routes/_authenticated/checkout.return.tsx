import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GlassCard } from "@/components/glass-card";
import { subscriptionQueryKey, useSubscription } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Order confirmed — Canvas Pro" },
      {
        name: "description",
        content: "Your Canvas Pro subscription is confirmed. Every feature is now unlocked.",
      },
      { property: "og:title", content: "Order confirmed — Canvas Pro" },
      {
        property: "og:description",
        content: "Your Canvas Pro subscription is confirmed. Every feature is now unlocked.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutReturnPage,
});

function CheckoutReturnPage() {
  const { session_id: sessionId } = Route.useSearch();
  const queryClient = useQueryClient();
  const { isActive } = useSubscription();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });
  }, [queryClient]);

  return (
    <div className="mx-auto w-full max-w-xl">
      <GlassCard
        title={sessionId ? "Payment complete" : "Checkout status"}
        subtitle={
          sessionId
            ? "Thanks for subscribing to Canvas Pro."
            : "We couldn't find your checkout session."
        }
      >
        <div className="flex w-full flex-col gap-4">
          {sessionId ? (
            <>
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? "Your subscription is active — every Pro feature is unlocked."
                  : "Your payment went through. Access unlocks as soon as the confirmation from your bank lands, usually within a few seconds."}
              </p>
              <p className="break-all text-xs text-muted-foreground">
                Reference: {sessionId}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              If you completed a payment, open Billing to check your subscription status.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/dashboard"
              className="glass-hover inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
            >
              Go to dashboard
            </Link>
            <Link
              to="/billing"
              className="glass-hover glass-inset inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
            >
              Manage subscription
            </Link>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
