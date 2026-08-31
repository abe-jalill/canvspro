// Persists the Canvas query cache to localStorage, scoped per account, so a
// reload paints real data instantly and revalidates in the background.
import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { persistQueryClient, type Persister } from "@tanstack/query-persist-client-core";
import { useUserScope, scopedKey } from "@/lib/user-scope";

const MAX_AGE = 24 * 60 * 60_000;
const BUSTER = "v1";

/** Query keys worth persisting — everything else is cheap or session-only. */
const PERSISTED_ROOTS = new Set([
  "canvas",
  "class-nicknames",
  "class-schedule-entries",
  "user-assignment-meta",
  "grade-snapshots",
  "user-preferences",
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
      shouldDehydrateQuery: (query) =>
        query.state.status === "success" &&
        PERSISTED_ROOTS.has(String(query.queryKey[0])),
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
