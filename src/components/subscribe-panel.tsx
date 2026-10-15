import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { startCheckoutFn } from "@/lib/billing.functions";
import { openPaddleCheckout, paddleConfigured } from "@/lib/paddle-client";
import { billingQueryKey } from "@/hooks/use-billing";
import {
  formatDay,
  PLANS,
  REFUND_WINDOW_DAYS,
  TRIAL_DAYS,
  type BillingStatus,
  type Plan,
} from "@/lib/billing";

const FEATURES = [
  "Every class, assignment, grade and announcement in one dashboard",
  "Reminders before things are due, even with the app closed",
  "Study sessions, schedule, widgets and the AI assistant connection",
];

/** How this account's checkout starts: a trial, its launch free days, or paying now. */
function checkoutOffer(status: BillingStatus | null, now = Date.now()) {
  const graceEnds = status?.grace_ends_at ? Date.parse(status.grace_ends_at) : NaN;
  if (status?.trial_used) return { kind: "paid" as const, until: null };
  if (Number.isFinite(graceEnds)) {
    return graceEnds > now
      ? { kind: "grace" as const, until: status!.grace_ends_at }
      : { kind: "paid" as const, until: null };
  }
  return { kind: "trial" as const, until: new Date(now + TRIAL_DAYS * 86_400_000).toISOString() };
}

export function SubscribePanel({ status }: { status: BillingStatus | null }) {
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState<Plan>("monthly");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const offer = checkoutOffer(status);
  const chosen = PLANS[plan];
  const price = `${chosen.price}/${chosen.per}`;
  const until = formatDay(offer.until);

  const disclosure =
    offer.kind === "trial"
      ? `Free for ${TRIAL_DAYS} days, then ${price} plus applicable tax, renewing automatically every ${chosen.per} until you cancel. Cancel before ${until} and you won't be charged.`
      : offer.kind === "grace"
        ? `Free until ${until}, then ${price} plus applicable tax, renewing automatically every ${chosen.per} until you cancel. Cancel before ${until} and you won't be charged.`
        : `${price} plus applicable tax, charged today and renewing automatically every ${chosen.per} until you cancel.`;

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const { transactionId } = await startCheckoutFn({ data: { plan } });
      await openPaddleCheckout(transactionId, () => {
        // Paddle's webhook usually lands within seconds; check until it has.
        setFinishing(true);
        let tries = 0;
        const timer = window.setInterval(() => {
          tries++;
          void queryClient.invalidateQueries({ queryKey: billingQueryKey });
          if (tries >= 15) window.clearInterval(timer);
        }, 2000);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <ul className="space-y-2 text-sm text-muted-foreground">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2">
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={plan === option}
            onClick={() => setPlan(option)}
            className={cn(
              "glass-hover rounded-2xl border p-4 text-left transition",
              plan === option ? "border-foreground" : "border-border",
            )}
          >
            <span className="block text-sm font-medium">
              {option === "monthly" ? "Monthly" : "Yearly"}
            </span>
            <span className="mt-1 block text-2xl font-semibold tracking-tight">
              {PLANS[option].price}
              <span className="text-sm font-normal text-muted-foreground">
                /{PLANS[option].per}
              </span>
            </span>
            {option === "yearly" && (
              <span className="mt-1 block text-xs text-muted-foreground">2 months free</span>
            )}
          </button>
        ))}
      </div>

      <p className="text-sm">{disclosure}</p>
      <p className="text-xs text-muted-foreground">
        Cancel anytime in Settings → Billing; you keep access until the end of the period you've
        paid for. Refunds are available within {REFUND_WINDOW_DAYS} days of a charge (
        <Link to="/refund-policy" className="underline underline-offset-4">
          Refund Policy
        </Link>
        ). Our order process is conducted by our online reseller Paddle.com, the Merchant of Record
        for all our orders.
      </p>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <span>
          I agree that my subscription renews automatically at the price above until I cancel, and
          to the{" "}
          <Link to="/terms" className="underline underline-offset-4">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link to="/refund-policy" className="underline underline-offset-4">
            Refund Policy
          </Link>
          .
        </span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {finishing && (
        <p role="status" className="text-sm text-muted-foreground">
          Payment received — unlocking CoursePro…
        </p>
      )}

      <button
        type="button"
        onClick={subscribe}
        disabled={!agreed || busy || !paddleConfigured()}
        className="glass-hover inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
      >
        {busy
          ? "Opening checkout…"
          : offer.kind === "trial"
            ? `Start ${TRIAL_DAYS}-day free trial`
            : offer.kind === "grace"
              ? `Subscribe — first charge ${until}`
              : `Subscribe for ${price}`}
      </button>
      {!paddleConfigured() && <p className="text-xs text-muted-foreground">Checkout opens soon.</p>}
    </div>
  );
}
