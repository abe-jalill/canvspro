import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { startCheckoutFn } from "@/lib/billing.functions";
import {
  closePaddleCheckout,
  formatMoney,
  openPaddleCheckout,
  PADDLE_FRAME_CLASS,
  paddleConfigured,
  type PaddleCheckoutTotals,
} from "@/lib/paddle-client";
import { billingQueryKey } from "@/hooks/use-billing";
import {
  formatDay,
  MONTHLY_FOR_A_YEAR,
  PLANS,
  REFUND_WINDOW_DAYS,
  TRIAL_DAYS,
  YEARLY_FREE_MONTHS,
  YEARLY_PER_MONTH,
  YEARLY_SAVINGS,
  type BillingStatus,
  type Plan,
} from "@/lib/billing";

const FEATURES = [
  "Every class, grade and assignment in one dashboard",
  "Reminders before things are due, even with the app closed",
  "Study sessions, schedule and home screen widgets",
  "Connect your AI assistant to your classes",
];

/** How this account's checkout starts: a trial, or its launch free days. */
function checkoutOffer(status: BillingStatus | null, now = Date.now()) {
  const graceEnds = status?.grace_ends_at ? Date.parse(status.grace_ends_at) : NaN;
  // Inside the launch free days the first charge waits for them to end;
  // otherwise every checkout starts with the free trial.
  if (Number.isFinite(graceEnds) && graceEnds > now) {
    return { kind: "grace" as const, until: status!.grace_ends_at };
  }
  return { kind: "trial" as const, until: new Date(now + TRIAL_DAYS * 86_400_000).toISOString() };
}

export function SubscribePanel({ status }: { status: BillingStatus | null }) {
  const queryClient = useQueryClient();
  // Yearly is picked to start: it's the better deal. The total below always
  // follows whichever plan is picked.
  const [plan, setPlan] = useState<Plan>("yearly");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [totals, setTotals] = useState<PaddleCheckoutTotals | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const offer = checkoutOffer(status);
  const chosen = PLANS[plan];
  const price = `${chosen.price}/${chosen.per}`;
  const until = formatDay(offer.until);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const { transactionId } = await startCheckoutFn({ data: { plan } });
      setTotals(null);
      setFrameReady(false);
      setTransactionId(transactionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
      setBusy(false);
    }
  }

  // Paddle draws into the frame element, so open it once that is on the page.
  useEffect(() => {
    if (!transactionId) return;
    let cancelled = false;
    openPaddleCheckout(transactionId, {
      onTotals: (next) => !cancelled && setTotals(next),
      onReady: () => !cancelled && setFrameReady(true),
      onComplete: () => {
        // Paddle's webhook usually lands within seconds; check until it has.
        setFinishing(true);
        let tries = 0;
        const timer = window.setInterval(() => {
          tries++;
          void queryClient.invalidateQueries({ queryKey: billingQueryKey });
          if (tries >= 15) window.clearInterval(timer);
        }, 2000);
      },
    })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't load the checkout.");
        setTransactionId(null);
      })
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
      closePaddleCheckout();
    };
  }, [transactionId, queryClient]);

  if (transactionId) {
    const renewal =
      totals?.recurringTotal != null
        ? `${formatMoney(totals.recurringTotal, totals.currency)}/${chosen.per}`
        : `${price} + tax`;
    return (
      <div className="@container">
        <div className="grid gap-6 @2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] @2xl:gap-8">
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => {
                setTransactionId(null);
                setFinishing(false);
              }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Change plan
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                CoursePro {plan === "monthly" ? "Monthly" : "Yearly"}
              </p>
              <p className="mt-2 text-3xl tracking-tight text-foreground">
                {offer.kind === "trial" ? `${TRIAL_DAYS} days free` : `Free until ${until}`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Then {renewal}. Cancel anytime.</p>
            </div>
            <dl className="glass-inset space-y-3 rounded-2xl p-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Due today</dt>
                <dd className="text-foreground">
                  {totals ? formatMoney(totals.total, totals.currency) : "$0.00"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Starting {until}</dt>
                <dd className="text-foreground">{renewal}</dd>
              </div>
              {totals?.recurringTax != null && totals.recurringTax > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <dt className="text-muted-foreground">Includes tax</dt>
                  <dd className="text-muted-foreground">
                    {formatMoney(totals.recurringTax, totals.currency)}
                  </dd>
                </div>
              )}
            </dl>
            <ul className="space-y-2.5 text-sm">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-foreground/10">
                    <Check className="h-3 w-3 text-foreground" aria-hidden />
                  </span>
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden />
              Secure checkout by Paddle, our Merchant of Record
            </p>
          </div>
          <div className="relative min-h-[450px] min-w-0">
            {!frameReady && !error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Loading secure checkout…
              </div>
            )}
            <div className={PADDLE_FRAME_CLASS} />
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            {finishing && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                Payment received — unlocking CoursePro…
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Plan" className="grid gap-3 pt-2 sm:grid-cols-2">
        {(["yearly", "monthly"] as const).map((option) => {
          const selected = plan === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(option)}
              className={cn(
                "relative flex flex-col rounded-2xl border p-5 text-left transition",
                selected
                  ? "border-foreground bg-foreground/[0.04] ring-1 ring-foreground"
                  : "border-border hover:border-foreground/40",
                option === "yearly" && !selected && "border-primary/40",
              )}
            >
              {option === "yearly" && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  {YEARLY_FREE_MONTHS} months free
                </span>
              )}
              <span className="flex items-center justify-between text-sm text-muted-foreground">
                {option === "monthly" ? "Monthly" : "Yearly"}
                <span
                  aria-hidden
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full border",
                    selected ? "border-foreground bg-foreground" : "border-muted-foreground/50",
                  )}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-background" />}
                </span>
              </span>
              <span className="mt-3 text-3xl tracking-tight text-foreground">
                {PLANS[option].price}
                <span className="text-sm text-muted-foreground"> / {PLANS[option].per}</span>
              </span>
              {option === "yearly" ? (
                <span className="mt-1 text-xs">
                  <s className="text-muted-foreground">{MONTHLY_FOR_A_YEAR}</s>{" "}
                  <span className="font-medium text-primary">Save {YEARLY_SAVINGS} a year</span>
                  <span className="text-muted-foreground"> · {YEARLY_PER_MONTH}/month</span>
                </span>
              ) : (
                <span className="mt-1 text-xs text-muted-foreground">
                  Billed monthly · {MONTHLY_FOR_A_YEAR} a year
                </span>
              )}
            </button>
          );
        })}
      </div>

      <ul className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-foreground/10">
              <Check className="h-3 w-3 text-foreground" aria-hidden />
            </span>
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="glass-inset space-y-3 rounded-2xl p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Due today</span>
          <span className="text-foreground">$0.00</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Starting {until}</span>
          <span className="text-foreground">{price} + tax</span>
        </div>
        <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          {offer.kind === "trial" ? `Free for ${TRIAL_DAYS} days` : `Free until ${until}`}, then{" "}
          {price} plus applicable tax, renewing automatically every {chosen.per} until you cancel.
          Cancel before {until} and you won't be charged.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted-foreground">
        <Checkbox
          checked={agreed}
          onCheckedChange={(value) => setAgreed(value === true)}
          className="mt-0.5 h-5 w-5 !rounded-[6px] border-muted-foreground/60"
        />
        <span>
          I agree that my subscription renews automatically at the price above until I cancel, and
          to the{" "}
          <Link to="/terms" className="text-foreground underline underline-offset-4">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link to="/refund-policy" className="text-foreground underline underline-offset-4">
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

      <div className="space-y-3">
        <button
          type="button"
          onClick={subscribe}
          disabled={!agreed || busy || !paddleConfigured()}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {busy
            ? "Opening checkout…"
            : offer.kind === "trial"
              ? `Start ${TRIAL_DAYS}-day free trial`
              : `Subscribe — first charge ${until}`}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden />
          {paddleConfigured() ? "Secure checkout by Paddle" : "Checkout opens soon"}
        </p>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground/80">
        Cancel anytime in Settings → Billing and keep access until the end of the period you've paid
        for. Refunds within {REFUND_WINDOW_DAYS} days of a charge. Our order process is conducted by
        our online reseller Paddle.com, the Merchant of Record for all our orders.
      </p>
    </div>
  );
}
