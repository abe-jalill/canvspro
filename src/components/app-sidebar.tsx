import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, BellOff, Lock, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useReminders } from "@/hooks/use-hourly-reminder";
import { supabase } from "@/integrations/supabase/client";
import { NotificationCenter } from "@/components/notification-center";
import { useSubscription } from "@/lib/subscription";
import { isFreePath } from "@/components/pro-gate";

const items = [
  { title: "Dashboard", to: "/" as const },
  { title: "Focus", to: "/focus" as const },
  { title: "Calendar", to: "/schedule" as const },
  { title: "Class Schedule", to: "/class-schedule" as const },
  { title: "Grades", to: "/grades" as const },
  { title: "Assignments", to: "/assignments" as const },
  { title: "Announcements", to: "/announcements" as const },
  { title: "Billing", to: "/billing" as const },
  { title: "Settings", to: "/settings" as const },
];

function useActivePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
}

function ReminderToggle({ compact = false }: { compact?: boolean }) {
  const { enabled, toggle } = useReminders();
  return (
    <button
      onClick={toggle}
      aria-label={enabled ? "Disable hourly reminders" : "Enable hourly reminders"}
      aria-pressed={enabled}
      className={cn(
        "glass-hover glass-inset flex items-center justify-center rounded-xl transition-colors",
        compact ? "h-11 w-11" : "h-11 w-full",
      )}
      title={enabled ? "Reminders on (9 AM – 9 PM)" : "Reminders off"}
    >
      {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      {!compact && (
        <span className="ml-2 text-xs font-medium">
          {enabled ? "Reminders on" : "Reminders off"}
        </span>
      )}
    </button>
  );
}

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={!isDark}
      className={cn(
        "glass-hover glass-inset flex items-center justify-center rounded-xl transition-colors",
        compact ? "h-11 w-11" : "h-11 w-full",
      )}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && (
        <span className="ml-2 text-xs font-medium">
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      )}
    </button>
  );
}

function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  const signOut = useSignOut();
  return (
    <button
      onClick={signOut}
      aria-label="Sign out"
      className={cn(
        "glass-hover glass-inset flex items-center justify-center rounded-xl transition-colors",
        compact ? "h-11 w-11" : "h-11 w-full",
      )}
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
      {!compact && <span className="ml-2 text-xs font-medium">Sign out</span>}
    </button>
  );
}

export function AppSidebar() {
  const pathname = useActivePath();
  const { isActive: isPro } = useSubscription();

  return (
    <aside className="fixed left-4 top-4 bottom-4 z-30 hidden w-56 flex-col md:flex">
      <div className="glass-panel-strong flex h-full flex-col overflow-y-auto p-5">
        <div className="mb-8 px-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Canvas
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight">Pro</p>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "glass-hover rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive(pathname, item.to)
                  ? "bg-foreground/[0.08] text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                {item.title}
                {!isPro && !isFreePath(item.to) && (
                  <Lock className="h-3.5 w-3.5 opacity-60" />
                )}
              </span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2 pt-4">
          {isPro && <ReminderToggle />}
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = useActivePath();
  const { isActive: isPro } = useSubscription();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const current = items.find((i) => isActive(pathname, i.to))?.title ?? "Canvas Pro";

  return (
    <div className="md:hidden">
      <div className="glass-panel-strong sticky top-2 z-40 mx-2 mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-2">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="glass-hover glass-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <p className="truncate text-center text-sm font-semibold tracking-tight">
          {current}
        </p>
        <div className="flex items-center gap-2">
          {isPro && <NotificationCenter />}
          <ThemeToggle compact />
        </div>
      </div>

      {open && (
        <div className="glass-panel-strong sticky top-[4.75rem] z-40 mx-2 mt-2 flex flex-col gap-1 p-2">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex min-h-11 items-center rounded-xl px-3 text-sm font-medium",
                isActive(pathname, item.to)
                  ? "bg-foreground/[0.08] text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                {item.title}
                {!isPro && !isFreePath(item.to) && (
                  <Lock className="h-3.5 w-3.5 opacity-60" />
                )}
              </span>
            </Link>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-2">
            {isPro && <ReminderToggle />}
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}
