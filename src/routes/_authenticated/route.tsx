import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { CanvasKeyBanner } from "@/components/canvas-key-banner";
import { ClassNamesGate } from "@/components/class-names-editor";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen w-full">
      <AppSidebar />
      <MobileNav />
      <main className="md:pl-64 md:pr-4 md:py-4">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 md:p-6">
          <CanvasKeyBanner />
          <ClassNamesGate>
            <Outlet />
          </ClassNamesGate>
        </div>
      </main>
    </div>
  );
}
