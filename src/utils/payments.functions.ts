import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type Stripe from "stripe";
import { type StripeEnv } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
      return data;
    },
  )
  // Checkout keeps the {CHECKOUT_SESSION_ID} placeholder, so the URL is
  // validated inside the handler where the helper can be imported server-side.
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    const { createStripeClient, getStripeErrorMessage } = await import(
      "@/lib/stripe.server"
    );
    const { resolveOrCreateCustomer } = await import("@/lib/stripe-customers.server");
    const { assertSafeReturnUrl } = await import("@/lib/return-url.server");
    const returnUrl = assertSafeReturnUrl(data.returnUrl);
    try {
      const { userId, supabase } = context;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const customerId = await resolveOrCreateCustomer(stripe, {
        email: user?.email ?? undefined,
        userId,
      });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: returnUrl,
        customer: customerId,
        managed_payments: { enabled: true },
        metadata: { userId, managed_payments: "true" },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      } as Stripe.Checkout.SessionCreateParams);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { createStripeClient, getStripeErrorMessage } = await import(
      "@/lib/stripe.server"
    );
    const { assertSafeReturnUrl } = await import("@/lib/return-url.server");
    const returnUrl = data.returnUrl ? assertSafeReturnUrl(data.returnUrl) : undefined;
    const { supabase, userId } = context;

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !sub?.stripe_customer_id) {
      return { error: "No subscription found" };
    }

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(returnUrl && { return_url: returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
