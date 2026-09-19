import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnv } from "@/lib/stripe.server";

export type SubscriptionAccess = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
} | null;

const inputSchema = z.object({
  environment: z.enum(["sandbox", "live"]),
});

/**
 * Paid access is resolved only from a server-authenticated, user-owned row.
 * No email, browser cache, cookie, or device state can grant access.
 */
export const getSubscriptionAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<SubscriptionAccess> => {
    const { data: authData, error: authError } = await context.supabase.auth.getUser();
    const verifiedUserId = authData.user?.id;
    if (authError || !verifiedUserId || verifiedUserId !== context.userId) {
      throw new Error("Not signed in");
    }

    const { data: subscription, error } = await context.supabase
      .from("subscriptions")
      .select("status, price_id, current_period_end, cancel_at_period_end")
      .eq("user_id", verifiedUserId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return subscription ?? null;
  });