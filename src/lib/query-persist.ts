import { useEffect } from "react";
import { dehydrate, hydrate, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getUserScope, useUserScope } from "./user-scope.ts";

const MAX_AGE = 24 * 60 * 60_000;
// Version 5 drops assignment bundles created while the Canvas proxy could
// incorrectly exclude an enrollment that Canvas itself reported as active.
const VERSION = 5;
// Never persist credentials, auth, or writable preference snapshots.
const ROOTS = new Set(["canvas", "user-profile", "user-settings", "class-nicknames", "class-schedule-entries", "user-assignment-meta", "grade-snapshots"]);

/** Called during identity setup, before any page query or first render. */
export function restoreQueryCache(client: QueryClient, userId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(`cp:${userId}:query-cache`);
    if (!raw) return;
    const saved = JSON.parse(raw);
    const legacy = saved.buster === "v2";
    const savedAt = legacy ? saved.timestamp : saved.savedAt;
    const state = legacy ? saved.clientState : saved.state;
    if ((!legacy && (saved.version !== VERSION || saved.userId !== userId)) ||
        !Number.isFinite(savedAt) || Date.now() - savedAt > MAX_AGE || savedAt > Date.now()) return;
    if (!Array.isArray(state?.queries)) return;
    hydrate(client, { mutations: [], queries: state.queries.filter((q: { queryKey?: unknown[] }) =>
      Array.isArray(q.queryKey) && ROOTS.has(String(q.queryKey[0]))) });
  } catch {
    // An unavailable or corrupt cache must never prevent sign-in.
  }
}

export function useQueryCachePersistence() {
  const client = useQueryClient();
  const scope = useUserScope();
  useEffect(() => {
    if (!scope) return;
    const key = `cp:${scope}:query-cache`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      if (getUserScope() !== scope) return;
      try {
        localStorage.setItem(key, JSON.stringify({
          version: VERSION, userId: scope, savedAt: Date.now(),
          state: dehydrate(client, {
            shouldDehydrateMutation: () => false,
            shouldDehydrateQuery: (q) => ROOTS.has(String(q.queryKey[0])) && q.state.data !== undefined,
          }),
        }));
      } catch { /* Storage full or disabled: in-memory cache still works. */ }
    };
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" && event.type !== "removed") return;
      if (!ROOTS.has(String(event.query.queryKey[0]))) return;
      if (!timer) timer = setTimeout(flush, 500);
    });
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [client, scope]);
}
