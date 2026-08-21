import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { CanvasKeyBanner } from "@/components/canvas-key-banner";
import { CanvasKeyGate } from "@/components/canvas-key-gate";
import { ClassNamesGate } from "@/components/class-names-editor";
import { ProGate } from "@/components/pro-gate";
import { useSubscription } from "@/lib/subscription";
import { NotificationCenter } from "@/components/notification-center";
import { useNotificationEngine } from "@/hooks/use-notification-engine";
import { setUserScope } from "@/lib/user-scope";

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
  useNotificationEngine(isPro);
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <AppSidebar />
      <MobileNav />
      <main className="md:pl-64 md:pr-4 md:py-4">
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-4 sm:px-4 md:p-6">

          <div className="mb-2 hidden justify-end md:flex">
            {isPro && <NotificationCenter />}
          </div>
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
