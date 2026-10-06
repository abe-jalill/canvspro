import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string }) => data)
  .handler(async (): Promise<CheckoutSessionResult> => ({
    error: "CanvasPro is free for everyone. New subscriptions are unavailable.",
  }));

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    try {
      const { createStripeClient, getStripeErrorMessage } = await import(
        "@/lib/stripe.server"
      );
      const { assertSafeReturnUrl } = await import("@/lib/return-url.server");
      const { resolveStripeEnv, ENTITLEMENT_ENV } = await import(
        "@/lib/payments-env.server"
      );
      const returnUrl = data.returnUrl ? assertSafeReturnUrl(data.returnUrl) : undefined;
      const { supabase, userId } = context;

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || authData.user?.id !== userId) {
        return { error: "Not signed in" };
      }

      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id, stripe_subscription_id, status, current_period_end")
        .eq("user_id", userId)
        .eq("environment", ENTITLEMENT_ENV)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError || !sub?.stripe_customer_id || !sub.stripe_subscription_id) {
        return { error: "No paid subscription found for this account" };
      }

      const stripe = createStripeClient(resolveStripeEnv());
      const stripeSubscription = await stripe.subscriptions.retrieve(
        sub.stripe_subscription_id as string,
      );
      const stripeCustomerId =
        typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : stripeSubscription.customer.id;
      const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
      const customerUserId =
        "deleted" in stripeCustomer && stripeCustomer.deleted
          ? null
          : stripeCustomer.metadata?.userId;
      const ownerUserId = stripeSubscription.metadata?.userId ?? customerUserId;
      if (
        ownerUserId !== userId ||
        stripeCustomerId !== sub.stripe_customer_id
      ) {
        return { error: "This subscription does not belong to the signed-in account" };
      }

      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(returnUrl && { return_url: returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      const { getStripeErrorMessage } = await import("@/lib/stripe.server");
      return { error: getStripeErrorMessage(error) };
    }
  });
