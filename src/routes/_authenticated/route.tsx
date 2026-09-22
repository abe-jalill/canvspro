import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useDueTodayBadge } from "@/hooks/use-due-today-badge";
import { useAppPrefetch } from "@/hooks/use-app-prefetch";
import { useWelcomeEmail } from "@/hooks/use-welcome-email";
import { purgeScopedStorage } from "@/lib/user-scope";
import { syncAuthIdentity } from "@/lib/auth-user";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useQueryCachePersistence } from "@/lib/query-persist";
import { useSidebarMode } from "@/lib/sidebar-state";
import { AppWarmupSplash } from "@/components/app-warmup-splash";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      purgeScopedStorage();
      syncAuthIdentity(context.queryClient, null);
      throw redirect({ to: "/auth" });
    }
    // Scope browser storage to this account and wipe any cache that belonged
    // to a different one BEFORE a single component renders.
    syncAuthIdentity(context.queryClient, data.user.id);
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isActive: isPro } = useSubscription();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarMode] = useSidebarMode();
  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);

  // Every page change starts at the top — on desktop the page scrolls inside
  // <main>, on mobile it scrolls the window, so reset both.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  // The moment Pro access is confirmed, drop any Canvas result fetched while it
  // was still unknown, so nothing stays blank waiting for a stale window.
  useEffect(() => {
    if (!isPro) return;
    void queryClient.invalidateQueries({ queryKey: ["canvas"] });
  }, [isPro, queryClient]);
  useNotificationEngine(isPro);
  useDueTodayBadge(isPro);
  useQueryCachePersistence();
  const warmup = useAppPrefetch(true);
  useWelcomeEmail(true);

  if (warmup === "warming") return <AppWarmupSplash />;

  return (
    <div className="min-h-dvh w-full overflow-x-hidden md:h-screen md:overflow-hidden">
      <AppSidebar />
      <MobileNav />
      <main
        ref={mainRef}
        className={cn(
          "transition-[padding] duration-300 ease-in-out md:h-screen md:overflow-y-auto md:py-4 md:pr-4",
          sidebarMode === "full" && "md:pl-64",
          sidebarMode === "rail" && "md:pl-[4.5rem]",
          sidebarMode === "hidden" && "md:pl-4",
        )}
      >
        <div className="ios-main-content mx-auto w-full min-w-0 max-w-6xl px-3 py-4 sm:px-4 md:p-6">
          <div className="mb-2 flex min-w-0 items-center justify-end gap-2">
            <CanvasLiveStatus />
            {/* Bell already lives in the mobile top bar — avoid a duplicate on phones */}
            {isPro && (
              <span className="hidden md:inline-flex">
                <NotificationCenter />
              </span>
            )}
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
