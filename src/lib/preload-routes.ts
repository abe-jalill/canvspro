import type { QueryClient } from "@tanstack/react-query";
import { classMeetingsQO } from "@/lib/canvas-queries";
import { fetchNicknames, nicknamesQueryKey } from "@/lib/nicknames";

/** Every page reachable from the signed-in shell, in priority order. */
const WARM_ROUTES = [
  "/dashboard",
  "/focus",
  "/assignments",
  "/grades",
  "/schedule",
  "/announcements",
  "/class-schedule",
  "/notifications",
  "/settings",
  "/billing",
] as const;

type PreloadRouter = {
  preloadRoute: (opts: { to: string }) => Promise<unknown>;
};

let hasWarmed = false;

function onSlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as unknown as {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return conn.effectiveType === "slow-2g" || conn.effectiveType === "2g";
}

function whenIdle(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  }).requestIdleCallback;
  if (ric) {
    const id = ric(fn, { timeout: 2000 });
    const cancel = (window as unknown as {
      cancelIdleCallback?: (id: number) => void;
    }).cancelIdleCallback;
    return () => cancel?.(id);
  }
  const t = window.setTimeout(fn, 600);
  return () => window.clearTimeout(t);
}

/**
 * Warms every authenticated page (code chunk + its data) in the background
 * once per session, so the first click on a nav item feels instant.
 * Best-effort: any failure is swallowed and the page still loads on click.
 */
export function warmAuthenticatedApp(
  router: PreloadRouter,
  qc: QueryClient,
): () => void {
  if (hasWarmed || typeof window === "undefined" || onSlowConnection()) {
    return () => {};
  }
  hasWarmed = true;

  let aborted = false;

  const cancelIdle = whenIdle(() => {
    void (async () => {
      // Data that isn't part of the shared Canvas warm-up.
      void qc
        .prefetchQuery(classMeetingsQO)
        .catch(() => {});
      void qc
        .prefetchQuery({
          queryKey: nicknamesQueryKey,
          queryFn: fetchNicknames,
          staleTime: 5 * 60_000,
        })
        .catch(() => {});

      // One route at a time so we never compete with the visible page.
      for (const to of WARM_ROUTES) {
        if (aborted) return;
        try {
          await router.preloadRoute({ to });
        } catch {
          /* preloading is best-effort */
        }
        await new Promise((r) => window.setTimeout(r, 50));
      }
    })();
  });

  return () => {
    aborted = true;
    cancelIdle();
  };
}

/** Allows a fresh warm-up after a sign-out / account switch. */
export function resetAppWarmup() {
  hasWarmed = false;
}
