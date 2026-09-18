import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { hasCompedAccess } from "@/lib/entitlements.functions";

export type SubscriptionRow = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

export const subscriptionQueryKey = ["subscription"] as const;

function isActive(sub: SubscriptionRow | null): boolean {
  if (!sub) return false;
  const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const future = !end || end.getTime() > Date.now();
  if (["active", "trialing", "past_due"].includes(sub.status)) return future;
  if (sub.status === "canceled") return !!end && end.getTime() > Date.now();
  return false;
}

export function useSubscription() {
  const query = useQuery({
    queryKey: subscriptionQueryKey,
    queryFn: async (): Promise<SubscriptionRow | null> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      // Complimentary access is decided server-side; no email list ships here.
      try {
        const { comped } = await hasCompedAccess();
        if (comped) {
          return {
            status: "active",
            price_id: "comped",
            current_period_end: null,
            cancel_at_period_end: false,
          };
        }
      } catch {
        // Fall through to the normal subscription lookup.
      }
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, price_id, current_period_end, cancel_at_period_end")
        .eq("user_id", userData.user.id)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as SubscriptionRow | null) ?? null;
    },
    staleTime: 5 * 60_000,
  });

  return {
    ...query,
    subscription: query.data ?? null,
    isActive: isActive(query.data ?? null),
  };
}
