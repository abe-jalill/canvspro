import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useSubscription } from "@/lib/subscription";

/** Warns during the 2-day grace window after a failed renewal payment. */
export function PastDueBanner() {
  const { subscription, pastDueGraceMs } = useSubscription();
  if (!subscription || subscription.status !== "past_due" || !pastDueGraceMs) return null;

  const hours = Math.max(1, Math.ceil(pastDueGraceMs / (60 * 60 * 1000)));

  return (
    <div className="glass-panel mb-4 flex w-full max-w-full flex-col gap-2 border-destructive/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-2 text-foreground/90">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <span>
          Your last payment didn&apos;t go through. Pro stays unlocked for about {hours} more{" "}
          {hours === 1 ? "hour" : "hours"} — update your payment method to keep access.
        </span>
      </span>
      <Link
        to="/billing"
        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-foreground px-4 text-xs font-semibold text-background"
      >
        Update payment
      </Link>
    </div>
  );
}
