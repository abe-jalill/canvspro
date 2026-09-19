import { useQuery } from "@tanstack/react-query";
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
 * One-off entitlement read for non-React callers, briefly memoised so a page
 * load doesn't repeat it. Used to skip Canvas requests the server would refuse
 * anyway (free accounts), so the paywall doesn't surface as a 402 error.
 * Fails closed: any problem means "not paid".
 */
let paidAt = 0;
let paidCache: Promise<boolean> | null = null;
const PAID_TTL_MS = 30_000;

export function fetchPaidAccess(): Promise<boolean> {
  if (paidCache && Date.now() - paidAt < PAID_TTL_MS) return paidCache;
  paidAt = Date.now();
  paidCache = getSubscriptionAccess()
    .then((row) => isActive(row ?? null))
    .catch(() => false);
  return paidCache;
}

/** Called after sign-out / subscription changes so nothing stale lingers. */
export function resetPaidAccessCache() {
  paidCache = null;
  paidAt = 0;
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
