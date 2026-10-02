// Single source of truth for "who is signed in".
//
// Every user-owned query key is namespaced with this id, and the whole query
// cache is dropped the moment the identity changes. That makes it impossible
// for one account's cached data (subscription status above all) to be read by
// the next account signing in on the same browser.

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setUserScope } from "@/lib/user-scope";
import { restoreQueryCache } from "@/lib/query-persist";
import { isOfflineLike } from "@/lib/offline-session";
import { setNicknameLookup, type NicknameLookupRow } from "@/lib/course-display";

export const authUserQueryKey = ["auth-user"] as const;

/** `undefined` = not observed yet, `null` = signed out. */
let activeIdentity: string | null | undefined;

export function getActiveIdentity(): string | null | undefined {
  return activeIdentity;
}

/**
 * Point the app at `userId`. When the identity differs from the one the cache
 * was populated for, the cache is wiped synchronously so no component can
 * observe the previous account's data — not even for a single render.
 */
export function syncAuthIdentity(
  queryClient: QueryClient,
  userId: string | null,
): void {
  setUserScope(userId);
  if (activeIdentity === userId) return;
  activeIdentity = userId;
  queryClient.clear();
  if (userId) restoreQueryCache(queryClient, userId);
  setNicknameLookup(queryClient.getQueryData<NicknameLookupRow[]>(["class-nicknames"]) ?? []);
  queryClient.setQueryData(authUserQueryKey, userId);
}

async function fetchAuthUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    // A network failure says nothing about who is signed in. Throw so the last
    // known identity stays in place instead of flipping everything to "anon".
    if (isOfflineLike(error)) throw error;
    // Treat any other auth error as "signed out" rather than pretending to know.
    return null;
  }
  return data.user?.id ?? null;
}

/**
 * Resolved id of the signed-in user. `isPending` is true until we actually
 * know — callers must fail closed while it is.
 */
export function useAuthUserId(): {
  userId: string | null;
  isPending: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: authUserQueryKey,
    queryFn: fetchAuthUserId,
    staleTime: 60_000,
    refetchOnMount: false,
    retry: 1,
  });
  return {
    userId: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
  };
}

/** Query key helper: `userKey(["subscription"], userId)`. */
export function userKey(
  base: readonly unknown[],
  userId: string | null,
): readonly unknown[] {
  return [...base, userId ?? "anon"];
}
