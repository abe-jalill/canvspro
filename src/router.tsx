import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 60_000,
        gcTime: 60 * 60_000,
        refetchOnWindowFocus: false,
        // Fresh shared results are reused; stale restored data refreshes behind it.
        refetchOnMount: true,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    scrollToTopSelectors: ["#app-main"],
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    defaultPreloadStaleTime: 30_000,
    defaultStaleTime: 5 * 60_000,
    defaultGcTime: 30 * 60_000,
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

  // Native transitions expose separate ready/finished promises. A redirect or
  // a fast second click can reject them even when the route commit succeeds.
  let activeTransition: ViewTransition | undefined;
  router.startViewTransition = (commit) => {
    if (
      typeof document === "undefined" ||
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !document.querySelector(".route-content")
    )
      return commit();
    activeTransition?.skipTransition();
    const transition = document.startViewTransition(commit);
    activeTransition = transition;
    void transition.ready.catch(() => undefined);
    const finished = () => {
      if (activeTransition === transition) activeTransition = undefined;
    };
    void transition.finished.then(finished, finished);
    // Route failures still reach the router error boundary.
    return transition.updateCallbackDone;
  };

  return router;
};
