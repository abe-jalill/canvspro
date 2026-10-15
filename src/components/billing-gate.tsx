import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { CreditCard, Sparkles } from "lucide-react";
import { useBilling } from "@/hooks/use-billing";
import { daysLeft, describeBilling, isPaywallAllowed } from "@/lib/billing";
import { isReviewAccount } from "@/lib/review-account";
import { SubscribePanel } from "@/components/subscribe-panel";

/**
 * Without a trial, a subscription or launch free days, every signed-in page
 * except billing and account settings shows the subscribe panel. The backend
 * enforces the same rule (the Canvas function answers 402); this is the UI.
 */
export function BillingGate({ email, children }: { email?: string | null; children: ReactNode }) {
  const { pathname } = useLocation();
  const billing = useBilling();
  // App Review's account sees sample data and is never asked to pay.
  if (isReviewAccount(email) || isPaywallAllowed(pathname)) return <>{children}</>;
  // While loading, on errors, or before billing is deployed, the backend decides.
  if (!billing.data || billing.data.access) return <>{children}</>;

  const copy = describeBilling(billing.data);
  return (
    <div className="mx-auto max-w-xl py-4 sm:py-8">
      <div className="glass-panel-strong space-y-5 rounded-[2rem] p-6 sm:p-8">
        <div className="space-y-2">
          <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">{copy.headline}</h1>
          {copy.detail && <p className="text-sm text-muted-foreground">{copy.detail}</p>}
        </div>
        <SubscribePanel status={billing.data} />
        <p className="text-xs text-muted-foreground">
          Need your data out or want to leave?{" "}
          <Link to="/settings/account" className="underline underline-offset-4">
            Account settings
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Trial, launch free days and failed-payment notices above every page. */
export function BillingBanner({ email }: { email?: string | null }) {
  const billing = useBilling();
  if (!billing.data || isReviewAccount(email)) return null;
  const copy = describeBilling(billing.data);
  const show =
    copy.state === "grace" ||
    copy.state === "past_due" ||
    (copy.state === "trial" &&
      !billing.data.cancel_at &&
      daysLeft(billing.data.trial_ends_at) <= 3);
  if (!show || !billing.data.access) return null;
  return (
    <div className="glass-panel-strong mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-medium">{copy.headline}</p>
          <p className="text-muted-foreground">{copy.detail}</p>
        </div>
      </div>
      <Link
        to="/settings/billing"
        className="glass-hover inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-background"
      >
        {copy.state === "past_due"
          ? "Update payment"
          : copy.state === "grace"
            ? "Subscribe"
            : "Manage"}
      </Link>
    </div>
  );
}
