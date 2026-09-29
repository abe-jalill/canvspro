import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { purgeScopedStorage } from "@/lib/user-scope";
import { getActiveIdentity, syncAuthIdentity } from "@/lib/auth-user";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme";
import { NativeAppEvents } from "@/components/native-app-events";

const themeBootScript = `try{var t=localStorage.getItem("canvas:theme"),p=localStorage.getItem("canvas:palette");document.documentElement.classList.add(t==="dark"||t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.palette=["forest","blue","violet","rose"].includes(p)?p:"forest"}catch(e){document.documentElement.classList.add("light");document.documentElement.dataset.palette="forest"}`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="glass-panel-strong max-w-md p-10 text-center">
        <h1 className="text-6xl font-semibold tracking-tight">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page doesn't exist.</p>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const reportedError = useMemo(
    () => (error instanceof Error ? error : new Error(String(error))),
    [error],
  );
  console.error(reportedError);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(reportedError, { boundary: "tanstack_root_error_component" });
  }, [reportedError]);

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="glass-panel-strong max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try refreshing or return home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="glass-hover rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "CanvasPro — A Better Canvas Dashboard for Students" },
      {
        name: "description",
        content:
          "See every Canvas class, grade, and deadline in one clean dashboard — free for everyone, with no subscription required.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "google-site-verification",
        content: "P8Sm6eDHpOJ5ZpV1NufDHGqBEtfhaWG4FTZ1gkc2w0M",
      },
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "CanvasPro" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon.png", type: "image/png", sizes: "512x512" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  // Decide from the URL (identical on server and client) instead of route
  // matches — the signed-in area is client-only, so matches differ during
  // hydration and caused a mismatch that blanked the page.
  const showFooter = useRouterState({
    select: (state) => {
      const first = state.location.pathname.split("/")[1] ?? "";
      return ![
        "admin",
        "announcements",
        "assignments",
        "class-schedule",
        "courses",
        "dashboard",
        "focus",
        "get-it-done",
        "grades",
        "notifications",
        "schedule",
        "settings",
        "study-session",
      ].includes(first);
    },
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Keep the native launch screen in place until the personalized startup
    // UI is mounted. Signed-out routes use the short fallback below.
    let secondFrame = 0;
    let firstFrame = 0;
    let hidden = false;
    const hide = () => {
      if (hidden) return;
      hidden = true;
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          void SplashScreen.hide();
        });
      });
    };
    window.addEventListener("canvaspro:launch-ui-ready", hide, { once: true });
    const fallback = window.setTimeout(() => {
      hide();
    }, 1_200);

    return () => {
      window.removeEventListener("canvaspro:launch-ui-ready", hide);
      window.clearTimeout(fallback);
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      if (!hidden) {
        void SplashScreen.hide();
      }
    };
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const nextId = event === "SIGNED_OUT" ? null : (session?.user?.id ?? null);
      const identityChanged = getActiveIdentity() !== nextId;
      if (event === "SIGNED_OUT") purgeScopedStorage();
      // Namespaces browser storage per account and drops the whole query
      // cache whenever the identity changes — no data can carry over.
      syncAuthIdentity(queryClient, nextId);
      if (identityChanged) void router.invalidate();
      if (event === "USER_UPDATED")
        void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NativeAppEvents />
        <div className="site-shell">
          <div id="main-content" tabIndex={-1} className="site-content outline-none">
            <Outlet />
          </div>
          {showFooter && !Capacitor.isNativePlatform() && <SiteFooter />}
        </div>
        <Toaster position="top-center" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
