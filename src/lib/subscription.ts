import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";

export type SubscriptionRow = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  updated_at: string | null;
};

export const subscriptionQueryKey = ["subscription"] as const;

/** Accounts that always have full Pro access, no payment required. */
const COMP_EMAILS = ["ajalil@ltu.edu"];

/** How long a failed payment keeps access before Pro locks. */
export const PAST_DUE_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

/** Milliseconds left in the failed-payment grace window, or null if not applicable. */
export function pastDueGraceRemaining(sub: SubscriptionRow | null): number | null {
  if (!sub || sub.status !== "past_due") return null;
  const since = sub.updated_at ? new Date(sub.updated_at).getTime() : Date.now();
  return Math.max(0, since + PAST_DUE_GRACE_MS - Date.now());
}

function isActive(sub: SubscriptionRow | null): boolean {
  if (!sub) return false;
  const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const future = !end || end.getTime() > Date.now();

  // Failed payment: keep access for a 2-day grace window, then lock.
  if (sub.status === "past_due") {
    const remaining = pastDueGraceRemaining(sub);
    return future && remaining !== null && remaining > 0;
  }
  if (["active", "trialing"].includes(sub.status)) return future;
  // Canceled: access continues through the period already paid for.
  if (sub.status === "canceled") return !!end && end.getTime() > Date.now();
  return false;
}

export function useSubscription() {
  const query = useQuery({
    queryKey: subscriptionQueryKey,
    queryFn: async (): Promise<SubscriptionRow | null> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const email = userData.user.email?.toLowerCase() ?? "";
      if (COMP_EMAILS.includes(email)) {
        return {
          status: "active",
          price_id: "comped",
          current_period_end: null,
          cancel_at_period_end: false,
          updated_at: null,
        };
      }
      if (!isPaymentsConfigured()) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, price_id, current_period_end, cancel_at_period_end, updated_at")
        .eq("user_id", userData.user.id)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as SubscriptionRow | null) ?? null;
    },

    staleTime: 30_000,
  });

  const subscription = query.data ?? null;

  return {
    ...query,
    subscription,
    isActive: isActive(subscription),
    pastDueGraceMs: pastDueGraceRemaining(subscription),
  };
}
