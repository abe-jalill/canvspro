import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { hasCompedAccess } from "@/lib/entitlements.functions";
import { useAuthUserId, userKey } from "@/lib/auth-user";

export type SubscriptionRow = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

/** Base key — invalidating this matches every per-user variant. */
export const subscriptionQueryKey = ["subscription"] as const;

function isActive(sub: SubscriptionRow | null): boolean {
  if (!sub) return false;
  const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const future = !end || end.getTime() > Date.now();
  if (["active", "trialing", "past_due"].includes(sub.status)) return future;
  if (sub.status === "canceled") return !!end && end.getTime() > Date.now();
  return false;
}

/**
 * Pro entitlement. Fails CLOSED: while the signed-in user is unknown, while
 * the lookup is in flight, or if the lookup errors, `isActive` is false.
 *
 * The row is read with the user's own session (RLS scopes `subscriptions` to
 * `auth.uid()`), and the query key carries the user id so a different account
 * can never read this result from cache.
 */
export function useSubscription() {
  const { userId, isPending: authPending, isError: authError } = useAuthUserId();

  const query = useQuery({
    queryKey: userKey(subscriptionQueryKey, userId),
    enabled: !!userId,
    queryFn: async (): Promise<SubscriptionRow | null> => {
      // Re-verify the session inside the fetch so a stale closure can never
      // attribute a subscription to the wrong account.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const currentId = userData.user?.id ?? null;
      if (userError || !currentId || currentId !== userId) {
        throw new Error("Not signed in");
      }

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
        // Not comped / verification unavailable — fall through to the DB read.
      }

      // Scope to the payment environment when it is known. If this build has
      // no payments token configured we must not lock a paying customer out,
      // so we read their newest row in any environment — still their own row
      // only, because RLS and this filter both scope to their user id.
      let environment: "sandbox" | "live" | null = null;
      try {
        environment = getStripeEnvironment();
      } catch {
        environment = null;
      }

      let select = supabase
        .from("subscriptions")
        .select("status, price_id, current_period_end, cancel_at_period_end")
        .eq("user_id", currentId);
      if (environment) select = select.eq("environment", environment);

      const { data, error } = await select
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as SubscriptionRow | null) ?? null;
    },
    staleTime: 60_000,
    // Never trust a warm cache across a reload for entitlement decisions.
    refetchOnMount: "always",
    retry: 1,
  });

  const resolved = !!userId && query.isSuccess;
  const isLoading = authPending || (!!userId && query.isPending);

  return {
    ...query,
    isLoading,
    subscription: resolved ? (query.data ?? null) : null,
    // Fail closed: only an explicitly successful lookup can unlock Pro.
    isActive: resolved && !authError && isActive(query.data ?? null),
  };
}
