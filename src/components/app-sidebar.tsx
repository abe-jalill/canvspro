import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, BellOff, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useReminders } from "@/hooks/use-hourly-reminder";

const items = [
  { title: "Dashboard", to: "/" as const },
  { title: "Focus", to: "/focus" as const },
  { title: "Schedule", to: "/schedule" as const },
  { title: "Class Schedule", to: "/class-schedule" as const },
  { title: "Grades", to: "/grades" as const },
  { title: "Assignments", to: "/assignments" as const },
  { title: "Announcements", to: "/announcements" as const },
];

function ReminderToggle({ compact = false }: { compact?: boolean }) {
  const { enabled, toggle } = useReminders();
  return (
    <button
      onClick={toggle}
      aria-label={enabled ? "Disable hourly reminders" : "Enable hourly reminders"}
      aria-pressed={enabled}
      className={cn(
        "glass-hover glass-inset flex items-center justify-center rounded-xl transition-colors",
        compact ? "h-8 w-8" : "h-9 w-full",
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
        compact ? "h-8 w-8" : "h-9 w-full",
      )}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      {!compact && (
        <span className="ml-2 text-xs font-medium">
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      )}
    </button>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="fixed left-4 top-4 bottom-4 z-30 hidden w-56 flex-col md:flex">
      <div className="glass-panel-strong flex h-full flex-col p-5">
        <div className="mb-8 px-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Canvas
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">
            Student
          </h1>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "glass-hover rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground/[0.08] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 pt-4">
          <ReminderToggle />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="glass-panel-strong sticky top-2 z-30 mx-2 mt-2 flex items-center gap-1 overflow-x-auto p-2 md:hidden">
      {items.map((item) => {
        const active =
          item.to === "/"
            ? pathname === "/"
            : pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium",
              active
                ? "bg-foreground/[0.08] text-foreground"
                : "text-muted-foreground",
            )}
          >
            {item.title}
          </Link>
        );
      })}
      <div className="ml-auto flex shrink-0 gap-1">
        <ReminderToggle compact />
        <ThemeToggle compact />
      </div>
    </div>
  );
}
