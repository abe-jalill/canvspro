// Persists the Canvas query cache to localStorage, scoped per account, so a
// reload paints real data instantly and revalidates in the background.
import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { persistQueryClient, type Persister } from "@tanstack/query-persist-client-core";
import { useUserScope, scopedKey } from "@/lib/user-scope";

const MAX_AGE = 24 * 60 * 60_000;
const BUSTER = "v2";

/** Query keys worth persisting — everything else is cheap or session-only.
 *
 * Deliberately excluded:
 *  - "subscription" / "auth-user": entitlements are never served from a cache.
 *  - "user-preferences": a restored (possibly stale) copy could become the
 *    basis for a write and overwrite newer data saved on another device.
 */
const PERSISTED_ROOTS = new Set([
  "canvas",
  "class-nicknames",
  "class-schedule-entries",
  "user-assignment-meta",
  "grade-snapshots",
]);

function makePersister(key: string): Persister {
  return {
    persistClient: async (client) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(client));
      } catch {
        // Quota or private mode — persistence is a nicety, never a hard failure.
      }
    },
    restoreClient: async () => {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

function start(queryClient: QueryClient, storageKey: string) {
  const [unsubscribe] = persistQueryClient({
    // Cast: persist-client-core resolves its own copy of query-core types.
    queryClient: queryClient as unknown as Parameters<typeof persistQueryClient>[0]["queryClient"],
    persister: makePersister(storageKey),
    maxAge: MAX_AGE,
    buster: BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        if (query.state.status !== "success") return false;
        if (!PERSISTED_ROOTS.has(String(query.queryKey[0]))) return false;
        // Never persist an empty result: a momentary blank (session still
        // settling, entitlement unresolved) must not be restored as "you have
        // no classes" on the next load.
        const data = query.state.data;
        if (Array.isArray(data) && data.length === 0) return false;
        return true;
      },
    },
  });
  return unsubscribe;
}

/** Mount once inside the authenticated layout. */
export function useQueryCachePersistence() {
  const queryClient = useQueryClient();
  const scope = useUserScope();

  useEffect(() => {
    if (typeof window === "undefined" || !scope) return;
    const unsubscribe = start(queryClient, scopedKey("query-cache"));
    return unsubscribe;
  }, [queryClient, scope]);
}
