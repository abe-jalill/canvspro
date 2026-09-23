import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { CanvasKeyBanner } from "@/components/canvas-key-banner";
import { CanvasKeyGate } from "@/components/canvas-key-gate";
import { ClassNamesGate } from "@/components/class-names-editor";
import { NotificationCenter } from "@/components/notification-center";
import { CanvasLiveStatus } from "@/components/canvas-live-status";
import { useNotificationEngine } from "@/hooks/use-notification-engine";
import { useDueTodayBadge } from "@/hooks/use-due-today-badge";
import { useAppPrefetch } from "@/hooks/use-app-prefetch";
import { useWelcomeEmail } from "@/hooks/use-welcome-email";
import { purgeScopedStorage } from "@/lib/user-scope";
import { syncAuthIdentity } from "@/lib/auth-user";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useQueryCachePersistence } from "@/lib/query-persist";
import { useSidebarMode } from "@/lib/sidebar-state";
import { cn } from "@/lib/utils";
import { AppStartupWelcome } from "@/components/app-startup-welcome";
import { RouteProgress } from "@/components/route-progress";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    // Local session gates the UI; APIs still validate the token and enforce RLS.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      purgeScopedStorage();
      syncAuthIdentity(context.queryClient, null);
      throw redirect({ to: "/auth" });
    }
    // Scope browser storage to this account and wipe any cache that belonged
    // to a different one BEFORE a single component renders.
    syncAuthIdentity(context.queryClient, data.session.user.id);
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarMode] = useSidebarMode();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if ("startViewTransition" in document) return;
    const animation = contentRef.current?.animate(
      [
        { opacity: 0, transform: "translateY(8px) scale(0.995)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    return () => animation?.cancel();
  }, [pathname]);

  useNotificationEngine(true);
  useDueTodayBadge(true);
  useQueryCachePersistence();
  const startup = useAppPrefetch(true);
  useWelcomeEmail(true);

  return (
    <div className="min-h-svh w-full overflow-x-hidden md:h-svh md:overflow-hidden">
      <AppStartupWelcome ready={startup === "ready"} user={user} />
      <RouteProgress />
      <AppSidebar />
      <MobileNav />
      <main
        id="app-main"
        data-scroll-restoration-id="app-main"
        className={cn(
          "transition-[padding] duration-300 ease-in-out md:h-svh md:overflow-y-auto md:py-4 md:pr-4",
          sidebarMode === "full" && "md:pl-64",
          sidebarMode === "rail" && "md:pl-[4.5rem]",
          sidebarMode === "hidden" && "md:pl-4",
        )}
      >
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-4 sm:px-4 md:p-6">
          <div className="mb-2 flex min-w-0 items-center justify-end gap-2">
            <CanvasLiveStatus />
            {/* Bell already lives in the mobile top bar — avoid a duplicate on phones */}
            <span className="hidden md:inline-flex">
              <NotificationCenter />
            </span>
          </div>
          <CanvasKeyBanner />
          <CanvasKeyGate>
            <ClassNamesGate>
              <PullToRefresh>
                <div ref={contentRef} className="route-content min-w-0">
                  <Outlet />
                </div>
              </PullToRefresh>
            </ClassNamesGate>
          </CanvasKeyGate>
        </div>
      </main>
    </div>
  );
}
