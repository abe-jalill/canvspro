import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { CanvasKeyBanner } from "@/components/canvas-key-banner";
import { CanvasKeyGate } from "@/components/canvas-key-gate";
import { ClassNamesGate } from "@/components/class-names-editor";
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
  useNotificationEngine();
  return (
    <div className="min-h-screen w-full">
      <AppSidebar />
      <MobileNav />
      <main className="md:pl-64 md:pr-4 md:py-4">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 md:p-6">
          <div className="mb-2 hidden justify-end md:flex">
            <NotificationCenter />
          </div>
          <CanvasKeyBanner />
          <CanvasKeyGate>
            <ClassNamesGate>
              <Outlet />
            </ClassNamesGate>
          </CanvasKeyGate>
        </div>
      </main>
    </div>
  );
}
