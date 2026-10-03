import { QueryClient } from "@tanstack/react-query";
import { createRouter, parseSearchWith, stringifySearchWith } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { watchReopenedAssignments } from "@/lib/reopened-assignments";

// Keep plain search values (like ?window=7 or ?assignment=123) readable in the
// address bar. The default JSON encoding wrapped number-like strings in quotes
// (?window=%227%22). Only objects, arrays and already-quoted legacy values are
// JSON; throwing for everything else tells the router to leave it as text.
function parseSearchValue(value: string): unknown {
  if (/^[[{"]/.test(value)) return JSON.parse(value);
  throw new Error("plain search value");
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CANVAS_DATA_STALE_MS,
        gcTime: CANVAS_DATA_GC_MS,
        refetchOnWindowFocus: false,
        // Fresh shared results are reused; stale restored data refreshes behind it.
        refetchOnMount: true,
        retry: 1,
      },
    },
  });

  watchReopenedAssignments(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    parseSearch: parseSearchWith(parseSearchValue),
    stringifySearch: stringifySearchWith(JSON.stringify, parseSearchValue),
    scrollRestoration: true,
    scrollToTopSelectors: ["#app-main"],
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultViewTransition: true,
    defaultPreloadStaleTime: 15 * 60_000,
    defaultStaleTime: 15 * 60_000,
    defaultGcTime: 6 * 60 * 60_000,
    // Keep the current screen in place through brief cold-chunk loads. The
    // progress hairline handles the rare longer wait; skeletons are reserved
    // for a genuinely uncached destination.
    defaultPendingMs: 500,
    defaultPendingMinMs: 0,
    defaultPendingComponent: () => (
      <div
        role="status"
        aria-label="Opening page"
        className="mx-auto w-full max-w-6xl space-y-4 p-6"
      >
        <div className="skeleton-shimmer h-5 w-44" />
        <div className="skeleton-shimmer h-48 rounded-2xl" />
      </div>
    ),
  });


  return router;
};
