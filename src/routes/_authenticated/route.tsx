import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { CanvasKeyBanner } from "@/components/canvas-key-banner";
import { CanvasKeyGate } from "@/components/canvas-key-gate";
import { ClassNamesGate } from "@/components/class-names-editor";
import { ProGate } from "@/components/pro-gate";
import { useSubscription } from "@/lib/subscription";
import { NotificationCenter } from "@/components/notification-center";
import { CanvasLiveStatus } from "@/components/canvas-live-status";
import { useNotificationEngine } from "@/hooks/use-notification-engine";
import { useAppPrefetch } from "@/hooks/use-app-prefetch";
import { useWelcomeEmail } from "@/hooks/use-welcome-email";
import { setUserScope } from "@/lib/user-scope";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useQueryCachePersistence } from "@/lib/query-persist";
import { useSidebarMode } from "@/lib/sidebar-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      setUserScope(null);
      throw redirect({ to: "/auth" });
    }
    // Scope all browser-stored state to this account.
    setUserScope(data.user.id);
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isActive: isPro } = useSubscription();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarMode] = useSidebarMode();
  useNotificationEngine(isPro);
  useQueryCachePersistence();
  useAppPrefetch(true);
  useWelcomeEmail(true);
  return (
    <div className="min-h-screen w-full overflow-x-hidden md:h-screen md:overflow-hidden">
      <AppSidebar />
      <MobileNav />
      <main className="md:h-screen md:overflow-y-auto md:pl-64 md:pr-4 md:py-4">
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-4 sm:px-4 md:p-6">
          <div className="mb-2 flex min-w-0 items-center justify-end gap-2">
            <CanvasLiveStatus />
            {isPro && <NotificationCenter />}
          </div>
          <CanvasKeyBanner />
          <CanvasKeyGate>
            <ClassNamesGate>
              <ProGate>
                <PullToRefresh>
                  <div key={pathname} className="page-transition min-w-0">
                    <Outlet />
                  </div>
                </PullToRefresh>
              </ProGate>
            </ClassNamesGate>
          </CanvasKeyGate>
        </div>
      </main>
    </div>
  );
}
