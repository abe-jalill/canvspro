import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.mobile.gen";
import "./styles.css";
import { AppLaunchShell } from "./components/app-launch-shell";
import { supabase } from "./integrations/supabase/client";
import { getActiveIdentity, syncAuthIdentity } from "./lib/auth-user";
import { restoreQueryCache } from "./lib/query-persist";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60_000,
      gcTime: 60 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreload: "intent",
  defaultPreloadDelay: 30,
  defaultPreloadStaleTime: 30_000,
  defaultPendingComponent: AppLaunchShell,
  defaultPendingMs: 0,
  defaultPendingMinMs: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function start() {
  // Scope and hydrate cached Canvas data before the first routed render. This
  // lets a returning student see their last dashboard immediately while the
  // normal queries validate and refresh it in the background.
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user.id ?? null;
  } catch {
    // The router will show the signed-out route if session storage is unavailable.
  }
  syncAuthIdentity(queryClient, userId);
  if (userId) {
    const restoringFor = userId;
    const restore = restoreQueryCache(queryClient)
      .then(() => {
        // If the account changed while a large cache was still parsing, erase
        // anything it just hydrated so the previous student's data can never
        // reappear after logout/login.
        if (getActiveIdentity() !== restoringFor) queryClient.clear();
      })
      .catch(() => undefined);
    // A damaged or oversized WebView cache must never hold the first React
    // frame hostage. Usually hydration wins this race; otherwise it safely
    // finishes in the background and React Query reconciles by updatedAt.
    await Promise.race([restore, new Promise<void>((resolve) => window.setTimeout(resolve, 250))]);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

void start();
