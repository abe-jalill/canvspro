import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SubscriptionAccess = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_subscription_id: string;
} | null;

/**
 * Paid access is resolved only from a server-authenticated, user-owned row in
 * the mode this server decides (never a client-supplied environment value).
 * No email, browser cache, cookie, or device state can grant access.
 */
export const getSubscriptionAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionAccess> => {
    const { ENTITLEMENT_ENV } = await import("@/lib/payments-env.server");
    const { data: authData, error: authError } = await context.supabase.auth.getUser();
    const verifiedUserId = authData.user?.id;
    if (authError || !verifiedUserId || verifiedUserId !== context.userId) {
      throw new Error("Not signed in");
    }

    const { data: subscription, error } = await context.supabase
      .from("subscriptions")
      .select("status, price_id, current_period_end, cancel_at_period_end, stripe_subscription_id")
      .eq("user_id", verifiedUserId)
      .eq("environment", ENTITLEMENT_ENV)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return subscription ?? null;
  });
