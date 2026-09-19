import { useQuery } from "@tanstack/react-query";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuthUserId, userKey } from "@/lib/auth-user";
import {
  getSubscriptionAccess,
  type SubscriptionAccess,
} from "@/lib/subscription.functions";

export type SubscriptionRow = NonNullable<SubscriptionAccess>;

/** Base key — invalidating this matches every per-user variant. */
export const subscriptionQueryKey = ["subscription"] as const;

function isActive(sub: SubscriptionRow | null): boolean {
  if (!sub) return false;
  const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const future = !end || end.getTime() > Date.now();
  if (["active", "trialing"].includes(sub.status)) return future;
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
    // The server decides which Stripe mode counts — the client never sends it.
    queryFn: async (): Promise<SubscriptionRow | null> => getSubscriptionAccess(),
    staleTime: 0,
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
