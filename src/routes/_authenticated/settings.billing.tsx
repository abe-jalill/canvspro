import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass-card";
import { SettingsPage } from "@/components/settings-page";
import { SubscribePanel } from "@/components/subscribe-panel";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { billingQueryKey, useBilling } from "@/hooks/use-billing";
import {
  dayCount,
  daysLeft,
  describeBilling,
  formatDay,
  PLANS,
  REFUND_WINDOW_DAYS,
  TRIAL_DAYS,
  type BillingStatus,
} from "@/lib/billing";
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
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:opacity-50";
const primary = `${button} bg-foreground text-background hover:opacity-90`;
const secondary = `${button} border border-border hover:bg-foreground/5`;

type Pending = null | "yearly" | "cancel";
type Tone = "trial" | "active" | "ending" | "failed";

const TONES: Record<Tone, string> = {
  trial: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  ending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  failed: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/** The facts the plan card shows, from the account's billing status. */
function planSummary(status: BillingStatus) {
  const plan = PLANS[status.plan ?? "monthly"];
  const ending = Boolean(status.cancel_at);
  const trialing = status.status === "trialing";
  const tone: Tone =
    status.status === "past_due" ? "failed" : ending ? "ending" : trialing ? "trial" : "active";
  const badge = {
    failed: "Payment failed",
    ending: "Canceled",
    trial: `Free trial · ${dayCount(daysLeft(status.trial_ends_at))} left`,
    active: "Active",
  }[tone];
  return {
    plan,
    tone,
    badge,
    name: status.plan === "yearly" ? "Yearly" : "Monthly",
    nextLabel: ending ? "Access until" : trialing ? "First charge" : "Next charge",
    nextDate: formatDay(
      ending ? status.cancel_at : trialing ? status.trial_ends_at : status.current_period_end,
    ),
    amount: ending ? "None" : `${plan.price} + tax`,
  };
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm text-foreground">{children}</dd>
    </div>
  );
}

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
      setPending(null);
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

  const summary = status && live ? planSummary(status) : null;
  const accessUntil = status
    ? formatDay(status.status === "trialing" ? status.trial_ends_at : status.current_period_end)
    : "";

  return (
    <SettingsPage title="Billing" description="Your plan, payments and cancellation.">
      {billing.isLoading ? (
        <GlassCard>
          <div className="space-y-3">
            <div className="skeleton-shimmer h-4 w-24 rounded" />
            <div className="skeleton-shimmer h-8 w-48 rounded" />
            <div className="skeleton-shimmer h-16 w-full rounded-2xl" />
          </div>
        </GlassCard>
      ) : !status ? (
        <GlassCard title="Your plan">
          <p className="text-sm text-muted-foreground">CoursePro is free for now.</p>
        </GlassCard>
      ) : summary ? (
        <GlassCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Current plan
              </p>
              <h2 className="mt-1 text-xl tracking-tight text-foreground">
                CoursePro {summary.name}
              </h2>
            </div>
            <span className={cn("rounded-full px-3 py-1 text-xs font-medium", TONES[summary.tone])}>
              {summary.badge}
            </span>
          </div>

          <p className="mt-4 text-4xl tracking-tight text-foreground">
            {summary.plan.price}
            <span className="text-base text-muted-foreground"> / {summary.plan.per}</span>
          </p>

          <dl className="glass-inset mt-5 grid grid-cols-1 divide-y divide-border rounded-2xl sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Fact label="Plan">{summary.name}</Fact>
            <Fact label={summary.nextLabel}>{summary.nextDate || "—"}</Fact>
            <Fact label="Amount">{summary.amount}</Fact>
          </dl>

          {copy?.detail && <p className="mt-4 text-sm text-muted-foreground">{copy.detail}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-5">
            {status.cancel_at ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => act(() => resumeSubscriptionFn())}
                className={primary}
              >
                Keep my subscription
              </button>
            ) : (
              status.plan === "monthly" && (
                <button type="button" disabled={busy} onClick={askYearly} className={primary}>
                  {busy && pending === null && <Loader2 className="h-4 w-4 animate-spin" />}
                  Switch to yearly · 2 months free
                </button>
              )
            )}
            <button type="button" disabled={busy} onClick={openPortal} className={secondary}>
              <CreditCard className="h-4 w-4" aria-hidden />
              {status.status === "past_due" ? "Update payment method" : "Payment method & receipts"}
            </button>
            {!status.cancel_at && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending("cancel")}
                className={`${button} text-muted-foreground hover:text-destructive sm:ml-auto`}
              >
                Cancel subscription
              </button>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </GlassCard>
      ) : (
        <GlassCard
          title={copy && copy.state !== "free" ? copy.headline : "Choose your plan"}
          subtitle={
            copy && copy.state !== "free"
              ? copy.detail
              : `Start with ${TRIAL_DAYS} days free. Cancel anytime before it ends and you won't be charged.`
          }
        >
          <SubscribePanel status={status} />
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </GlassCard>
      )}

      {/* The subscribe panel carries its own fine print. */}
      {status && (live || status.has_subscription) && (
        <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Payments are processed securely by Paddle.com, our Merchant of Record. Refunds are
            available within {REFUND_WINDOW_DAYS} days of a charge —{" "}
            <Link to="/refund-policy" className="underline underline-offset-4">
              Refund Policy
            </Link>
            .
            {!live && status.has_subscription && (
              <>
                {" "}
                <button type="button" onClick={openPortal} className="underline underline-offset-4">
                  Past receipts
                </button>
              </>
            )}
          </span>
        </p>
      )}

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !busy && setPending(null)}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl sm:rounded-2xl">
          {pending === "yearly" && status ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Switch to yearly?</AlertDialogTitle>
                <AlertDialogDescription>
                  {PLANS.yearly.price}/year — two months free compared with monthly.{" "}
                  {status.status === "trialing"
                    ? `Nothing is charged now. Your first charge on ${formatDay(status.trial_ends_at)} will be ${PLANS.yearly.price} plus tax.`
                    : yearlyCharge
                      ? `You'll be charged ${yearlyCharge} today, with the unused part of this month credited.`
                      : "The unused part of this month is credited against the year."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPending(null)}
                  className={secondary}
                >
                  Keep monthly
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => switchToYearlyFn({ data: { confirm: true } }))}
                  className={primary}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Switch to yearly
                </button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll keep CoursePro until {accessUntil} and won't be charged again. You can undo
                  this any time before then.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPending(null)}
                  className={secondary}
                >
                  Keep subscription
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => cancelSubscriptionFn())}
                  className={`${button} bg-destructive text-destructive-foreground hover:opacity-90`}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cancel subscription
                </button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPage>
  );
}
