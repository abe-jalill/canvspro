import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { GlassCard } from "@/components/glass-card";
import { SettingsPage } from "@/components/settings-page";
import { SubscribePanel } from "@/components/subscribe-panel";
import { billingQueryKey, useBilling } from "@/hooks/use-billing";
import { describeBilling, formatDay, PLANS, REFUND_WINDOW_DAYS } from "@/lib/billing";
import {
  billingPortalFn,
  cancelSubscriptionFn,
  resumeSubscriptionFn,
  switchToYearlyFn,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  head: () => ({
    meta: [
      { title: "Billing — CoursePro" },
      { name: "description", content: "Your CoursePro plan, payments and cancellation." },
      { property: "og:title", content: "Billing — CoursePro" },
      { property: "og:description", content: "Your CoursePro plan, payments and cancellation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingSettingsPage,
});

const LIVE = new Set(["trialing", "active", "past_due"]);
const button =
  "glass-hover inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium disabled:opacity-50";

type Pending = null | "yearly" | "cancel";

function BillingSettingsPage() {
  const queryClient = useQueryClient();
  const billing = useBilling();
  const [pending, setPending] = useState<Pending>(null);
  const [yearlyCharge, setYearlyCharge] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = billing.data ?? null;
  const live = Boolean(status?.status && LIVE.has(status.status));
  const copy = status ? describeBilling(status) : null;

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: billingQueryKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function askYearly() {
    setBusy(true);
    setError(null);
    try {
      const preview = await switchToYearlyFn({ data: { confirm: false } });
      setYearlyCharge(preview.chargeNow);
      setPending("yearly");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't price the change.");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await billingPortalFn();
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the billing portal.");
      setBusy(false);
    }
  }

  return (
    <SettingsPage title="Billing" description="Your plan, payments and cancellation.">
      {billing.isLoading ? (
        <GlassCard title="Your plan">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </GlassCard>
      ) : !status ? (
        <GlassCard title="Your plan">
          <p className="text-sm text-muted-foreground">CoursePro is free for now.</p>
        </GlassCard>
      ) : (
        <>
          <GlassCard title={copy?.headline ?? "Your plan"} subtitle={copy?.detail || undefined}>
            {live ? (
              <div className="space-y-4">
                {pending === "yearly" ? (
                  <div className="space-y-3 text-sm">
                    <p>
                      Switch to yearly ({PLANS.yearly.price}/year).{" "}
                      {status.status === "trialing"
                        ? `Nothing is charged now; your first charge on ${formatDay(status.trial_ends_at)} will be ${PLANS.yearly.price} plus tax.`
                        : yearlyCharge
                          ? `You'll be charged ${yearlyCharge} now, with the unused part of this month credited.`
                          : "The unused part of this month is credited against the year."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(() => switchToYearlyFn({ data: { confirm: true } }))}
                        className={`${button} bg-foreground text-background`}
                      >
                        {busy ? "Switching…" : "Switch to yearly"}
                      </button>
                      <button type="button" onClick={() => setPending(null)} className={button}>
                        Keep monthly
                      </button>
                    </div>
                  </div>
                ) : pending === "cancel" ? (
                  <div className="space-y-3 text-sm">
                    <p>
                      Cancel your subscription? You keep CoursePro until{" "}
                      {formatDay(
                        status.status === "trialing"
                          ? status.trial_ends_at
                          : status.current_period_end,
                      )}{" "}
                      and won't be charged again.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(() => cancelSubscriptionFn())}
                        className={`${button} bg-destructive text-destructive-foreground`}
                      >
                        {busy ? "Canceling…" : "Cancel subscription"}
                      </button>
                      <button type="button" onClick={() => setPending(null)} className={button}>
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {status.plan === "monthly" && !status.cancel_at && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={askYearly}
                        className={`${button} bg-foreground text-background`}
                      >
                        Switch to yearly — 2 months free
                      </button>
                    )}
                    {status.cancel_at ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(() => resumeSubscriptionFn())}
                        className={`${button} bg-foreground text-background`}
                      >
                        Keep my subscription
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPending("cancel")}
                        className={button}
                      >
                        Cancel subscription
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={openPortal} className={button}>
                      Payment method &amp; receipts
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <SubscribePanel status={status} />
            )}
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </GlassCard>
          <p className="px-1 text-xs text-muted-foreground">
            Refunds are available within {REFUND_WINDOW_DAYS} days of a charge —{" "}
            <Link to="/refund-policy" className="underline underline-offset-4">
              Refund Policy
            </Link>
            . Payments are processed by Paddle.com, our Merchant of Record.
            {!live && status.has_subscription && (
              <>
                {" "}
                <button type="button" onClick={openPortal} className="underline underline-offset-4">
                  Past receipts
                </button>
              </>
            )}
          </p>
        </>
      )}
    </SettingsPage>
  );
}
