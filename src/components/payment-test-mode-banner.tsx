const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">
        Checkout is not configured yet. Complete payments go-live to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full rounded-xl border border-foreground/15 bg-foreground/[0.06] px-4 py-2 text-center text-xs text-muted-foreground">
        Payments are in test mode — use card 4242 4242 4242 4242 to try checkout.
      </div>
    );
  }
  return null;
}
