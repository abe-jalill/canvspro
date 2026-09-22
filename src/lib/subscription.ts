import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthUserId, userKey } from "@/lib/auth-user";
import {
  getSubscriptionAccess,
  resetSubscriptionAccessRequest,
  type SubscriptionAccess,
} from "@/lib/subscription.functions";
import { scopedKey } from "@/lib/user-scope";

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
 * One-off entitlement read for non-React callers, used only to skip Canvas
 * requests the server would refuse anyway (free accounts) so the paywall never
 * surfaces as a 402 error.
 *
 * Returns "unknown" when the lookup could not be completed (no session yet,
 * network hiccup). Callers must NOT treat "unknown" as free: doing that is what
 * made pages render blank right after sign-in, because an empty result got
 * cached for minutes. Only a definite answer is memoised; the server-side
 * paywall stays the real boundary either way.
 */
export type Entitlement = "paid" | "free" | "unknown";

let paidAt = 0;
let paidCache: Promise<Entitlement> | null = null;
const PAID_TTL_MS = 30_000;
const SUBSCRIPTION_SNAPSHOT_KEY = "subscription:last-known";
const SUBSCRIPTION_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60_000;

interface StoredSubscription {
  savedAt: number;
  value: SubscriptionAccess;
}

function readStoredSubscription(): StoredSubscription | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(scopedKey(SUBSCRIPTION_SNAPSHOT_KEY)) ?? "null",
    ) as StoredSubscription | null;
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      parsed.savedAt > Date.now() ||
      Date.now() - parsed.savedAt > SUBSCRIPTION_SNAPSHOT_MAX_AGE_MS
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function storeSubscription(value: SubscriptionAccess) {
  try {
    window.localStorage.setItem(
      scopedKey(SUBSCRIPTION_SNAPSHOT_KEY),
      JSON.stringify({ savedAt: Date.now(), value } satisfies StoredSubscription),
    );
  } catch {
    // A fresh network result still works when private storage is unavailable.
  }
}

export function fetchEntitlement(): Promise<Entitlement> {
  if (paidCache && Date.now() - paidAt < PAID_TTL_MS) return paidCache;
  paidAt = Date.now();
  const pending: Promise<Entitlement> = getSubscriptionAccess()
    .then((row): Entitlement => (isActive(row ?? null) ? "paid" : "free"))
    .catch((): Entitlement => {
      // Don't remember a failure — the next caller should ask again.
      if (paidCache === pending) resetPaidAccessCache();
      return "unknown";
    });
  paidCache = pending;
  return pending;
}

/** Called after sign-out / subscription changes so nothing stale lingers. */
export function resetPaidAccessCache() {
  paidCache = null;
  paidAt = 0;
  resetSubscriptionAccessRequest();
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

  const stored = userId ? readStoredSubscription() : undefined;
  const query = useQuery({
    queryKey: userKey(subscriptionQueryKey, userId),
    enabled: !!userId,
    // The server decides which Stripe mode counts — the client never sends it.
    queryFn: async (): Promise<SubscriptionRow | null> => getSubscriptionAccess(),
    initialData: stored?.value,
    initialDataUpdatedAt: stored?.savedAt,
    staleTime: 0,
    // Never trust a warm cache across a reload for entitlement decisions.
    refetchOnMount: "always",
    retry: 1,
  });

  useEffect(() => {
    // `initialData` is only a fast visual snapshot. Do not rewrite it with a
    // new timestamp before the background request completes, or stale access
    // could be extended indefinitely every time the app opens.
    if (
      userId &&
      query.isSuccess &&
      query.fetchStatus === "idle" &&
      query.dataUpdatedAt > (stored?.savedAt ?? 0)
    ) {
      storeSubscription(query.data ?? null);
    }
  }, [
    query.data,
    query.dataUpdatedAt,
    query.fetchStatus,
    query.isSuccess,
    stored?.savedAt,
    userId,
  ]);

  const resolved = !!userId && (query.isSuccess || query.data !== undefined);
  const isLoading = authPending || (!!userId && query.isPending && query.data === undefined);

  return {
    ...query,
    isLoading,
    subscription: resolved ? (query.data ?? null) : null,
    // A recent account-scoped snapshot unlocks cached UI immediately; the
    // live server response always revalidates it in the background.
    isActive: resolved && !authError && isActive(query.data ?? null),
  };
}
