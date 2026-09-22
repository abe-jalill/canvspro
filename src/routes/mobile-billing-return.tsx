import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect } from "react";
import { GlassCard } from "@/components/glass-card";

export const Route = createFileRoute("/mobile-billing-return")({
  validateSearch: (search: Record<string, unknown>): { result?: string } => ({
    result: typeof search.result === "string" ? search.result : undefined,
  }),
  component: MobileBillingReturn,
});

function MobileBillingReturn() {
  const { result } = Route.useSearch();
  const completed = result === "success";
  const appUrl = `canvaspro://billing?result=${completed ? "success" : "cancelled"}`;

  useEffect(() => {
    // This route is the return target of the in-app Stripe browser. Hand the
    // user back automatically, with the visible link below as a safe fallback.
    const timeout = window.setTimeout(() => window.location.assign(appUrl), 350);
    return () => window.clearTimeout(timeout);
  }, [appUrl]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <GlassCard
        strong
        className="w-full max-w-md text-center"
        title={completed ? "Payment complete" : "Billing closed"}
        subtitle="Return to CanvasPro to refresh your access."
      >
        {completed ? (
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        ) : (
          <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        )}
        <a
          href={appUrl}
          className="glass-hover mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
        >
          Return to CanvasPro
        </a>
      </GlassCard>
    </main>
  );
}
