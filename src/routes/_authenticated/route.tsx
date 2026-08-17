import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { CanvasKeyBanner } from "@/components/canvas-key-banner";
import { CanvasKeyGate } from "@/components/canvas-key-gate";
import { ClassNamesGate } from "@/components/class-names-editor";
import { PastDueBanner } from "@/components/past-due-banner";
import { ProGate } from "@/components/pro-gate";

import { useSubscription } from "@/lib/subscription";
import { NotificationCenter } from "@/components/notification-center";
import { useNotificationEngine } from "@/hooks/use-notification-engine";
import { setUserScope } from "@/lib/user-scope";
import { allCanvasQueries } from "@/lib/canvas-queries";
import { hydrateCanvasCache, persistCanvasCache } from "@/lib/canvas-cache";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads the locally cached session (and refreshes it only
    // when expired), so navigation doesn't wait on a network round-trip.
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (error || !user) {
      setUserScope(null);
      throw redirect({ to: "/auth" });
    }
    // Scope all browser-stored state to this account.
    setUserScope(user.id);
    return { user };
  },
  component: AuthenticatedLayout,
});



function AuthenticatedLayout() {
  const { isActive: isPro } = useSubscription();
  useNotificationEngine(isPro);
  const qc = useQueryClient();

  // Paint from the last known payloads immediately, then warm every Canvas
  // query once per session so switching pages never waits on the network.
  useEffect(() => {
    hydrateCanvasCache(qc);
    const stop = persistCanvasCache(qc);
    for (const qo of allCanvasQueries) {
      void qc.prefetchQuery(qo);
    }
    return stop;
  }, [qc]);


  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <AppSidebar />
      <MobileNav />
      <main className="md:pl-64 md:pr-4 md:py-4">
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-4 sm:px-4 md:p-6">

          <div className="mb-2 hidden justify-end md:flex">
            {isPro && <NotificationCenter />}
          </div>
          <PastDueBanner />
          <CanvasKeyBanner />

          <CanvasKeyGate>
            <ClassNamesGate>
              <ProGate>
                <Outlet />
              </ProGate>
            </ClassNamesGate>
          </CanvasKeyGate>
        </div>
      </main>
    </div>
  );
}
