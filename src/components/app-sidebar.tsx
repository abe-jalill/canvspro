import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Bell,
  BellOff,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Crosshair,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Megaphone,
  Moon,
  Settings,
  Sun,
  TimerReset,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useReminders } from "@/hooks/use-hourly-reminder";
import { supabase } from "@/integrations/supabase/client";
import { purgeScopedStorage, useUserScope } from "@/lib/user-scope";
import { syncAuthIdentity } from "@/lib/auth-user";
import { NotificationCenter } from "@/components/notification-center";
import { ProfileButton } from "@/components/profile-button";
import { TrafficLights } from "@/components/traffic-lights";
import { getCoursesFn, type CourseSummary } from "@/lib/canvas.functions";
import { displayCourseNameForCourse } from "@/lib/course-display";
import { getGradeColor } from "@/lib/grade-color";
import { useSidebarMode } from "@/lib/sidebar-state";
import { useIsAdmin } from "@/hooks/use-is-admin";

const items = [
  { title: "Dashboard", to: "/dashboard" as const, icon: LayoutDashboard },
  { title: "Get It Done", to: "/get-it-done" as const, icon: ClipboardCheck },
  { title: "Focus", to: "/focus" as const, icon: Crosshair },
  { title: "Study Session", to: "/study-session" as const, icon: TimerReset },
  { title: "Calendar", to: "/schedule" as const, icon: CalendarDays },
  { title: "Class Schedule", to: "/class-schedule" as const, icon: CalendarClock },
  { title: "Grades", to: "/grades" as const, icon: GraduationCap },
  { title: "Assignments", to: "/assignments" as const, icon: ListChecks },
  { title: "Announcements", to: "/announcements" as const, icon: Megaphone },
  { title: "Notifications", to: "/notifications" as const, icon: Bell },
  { title: "Settings", to: "/settings" as const, icon: Settings },
];

const adminItem = { title: "Usage", to: "/admin" as string as "/settings", icon: BarChart3 };

/** Nav entries for this account — the usage screen only exists for the owner. */
function useNavItems() {
  const { isAdmin } = useIsAdmin();
  return isAdmin ? [...items, adminItem] : items;
}

const coursesQO = queryOptions({
  queryKey: ["canvas", "courses"],
  queryFn: () => getCoursesFn(),
  staleTime: 5 * 60_000,
});

function useActivePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
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
        <span className="ml-2 text-xs font-medium">{isDark ? "Light mode" : "Dark mode"}</span>
      )}
    </button>
  );
}

function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scope = useUserScope();
  return async function signOut() {
    await queryClient.cancelQueries();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      toast.error("Could not sign out", { description: error.message });
      return;
    }
    queryClient.clear();
    purgeScopedStorage(scope);
    syncAuthIdentity(queryClient, null);
    // The cache persister flushes once more after clear(); drop that too so
    // nothing of this account is left behind on the device.
    purgeScopedStorage(scope);
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
  const navItems = useNavItems();
  const courses = useQuery(coursesQO);
  const [mode, setMode] = useSidebarMode();

  const rail = mode === "rail";
  const hidden = mode === "hidden";

  return (
    <>
      {/* Floating reopen pill when the sidebar is fully closed */}
      <div
        className={cn(
          "fixed left-4 top-4 z-40 hidden transition-all duration-300 md:block",
          hidden ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-6 opacity-0",
        )}
      >
        <div className="glass-panel-strong p-1">
          <TrafficLights
            onRed={() => setMode("hidden")}
            onYellow={() => setMode("rail")}
            onGreen={() => setMode("full")}
          />
        </div>
      </div>

      <aside
        className={cn(
          "fixed bottom-4 left-4 top-4 z-30 hidden flex-col transition-all duration-300 ease-in-out md:flex",
          rail ? "w-14" : "w-56",
          hidden && "pointer-events-none -translate-x-[110%] opacity-0",
        )}
        aria-hidden={hidden}
      >
        <div
          className={cn(
            "glass-panel-strong flex h-full flex-col overflow-y-auto transition-[padding] duration-300",
            rail ? "items-center p-2" : "p-5",
          )}
        >
          {rail ? (
            /* ---- Slim rail mode ---- */
            <>
              <div className="mb-4">
                <TrafficLights
                  className="flex-col gap-1.5 px-1.5 py-2"
                  onRed={() => setMode("hidden")}
                  onYellow={() => setMode("rail")}
                  onGreen={() => setMode("full")}
                />
              </div>
              <nav className="flex w-full flex-col items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      preload="intent"
                      title={item.title}
                      aria-label={item.title}
                      className={cn(
                        "press flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                        isActive(pathname, item.to)
                          ? "bg-foreground/[0.08] text-foreground shadow-sm"
                          : "text-muted-foreground/80 hover:bg-foreground/[0.04] hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  );
                })}
                <div className="my-2 h-[1px] w-6 rounded-full bg-white/10" />
                {courses.data?.map((course: CourseSummary) => {
                  const courseName = displayCourseNameForCourse(
                    course.id,
                    course.name,
                    course.course_code,
                  );
                  const color = getGradeColor(course.current_score);
                  const coursePath = `/courses/${course.id}`;
                  return (
                    <Link
                      key={course.id}
                      to="/courses/$courseId"
                      params={{ courseId: String(course.id) }}
                      preload="intent"
                      title={courseName}
                      aria-label={courseName}
                      className={cn(
                        "press flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                        pathname === coursePath
                          ? "bg-foreground/[0.08]"
                          : "hover:bg-foreground/[0.04]",
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
                      />
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto flex flex-col items-center gap-2 pt-4">
                <ReminderToggle compact />
                <ThemeToggle compact />
                <SignOutButton compact />
              </div>
            </>
          ) : (
            /* ---- Full mode ---- */
            <>
              <div className="mb-8 flex items-start justify-between gap-2">
                <Link
                  to="/"
                  preload="intent"
                  className="block min-w-0 flex-1 px-2 press transition-opacity hover:opacity-80"
                  aria-label="Go to homepage"
                >
                  <span className="block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {"\n"}
                  </span>
                  <span className="mt-1 block truncate text-base font-normal tracking-tight text-foreground">
                    CanvasPro
                  </span>
                </Link>
                <TrafficLights
                  className="relative z-10 shrink-0"
                  onRed={() => setMode("hidden")}
                  onYellow={() => setMode("rail")}
                  onGreen={() => setMode("full")}
                />
              </div>
              <nav className="flex flex-col gap-0.5">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    preload="intent"
                    className={cn(
                      "press rounded-xl px-3 py-2 text-sm transition-all",
                      isActive(pathname, item.to)
                        ? "bg-foreground/[0.08] text-foreground font-medium shadow-sm"
                        : "text-muted-foreground/80 hover:bg-foreground/[0.04] hover:text-foreground font-normal",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-1 w-1 shrink-0 rounded-full bg-primary transition-[opacity,transform] duration-200",
                            isActive(pathname, item.to)
                              ? "scale-100 opacity-100"
                              : "scale-50 opacity-0",
                          )}
                        />
                        <span className="truncate">{item.title}</span>
                      </span>
                    </span>
                  </Link>
                ))}

                <div className="my-2.5 flex items-center justify-center">
                  <div className="h-[1px] w-20 rounded-full bg-white/10" />
                </div>

                <div className="flex flex-col gap-0.5">
                  {courses.data &&
                    courses.data.length > 0 &&
                    courses.data.map((course: CourseSummary) => {
                      const courseName = displayCourseNameForCourse(
                        course.id,
                        course.name,
                        course.course_code,
                      );
                      const score = course.current_score;
                      const color = getGradeColor(score);
                      const coursePath = `/courses/${course.id}`;
                      const active = pathname === coursePath;

                      return (
                        <Link
                          key={course.id}
                          to="/courses/$courseId"
                          params={{ courseId: String(course.id) }}
                          preload="intent"
                          title={`${courseName} (${score != null ? score.toFixed(1) + "%" : "No grade"})`}
                          className={cn(
                            "press flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-all group",
                            active
                              ? "bg-foreground/[0.08] text-foreground font-medium shadow-sm"
                              : "text-muted-foreground/80 hover:bg-foreground/[0.04] hover:text-foreground font-normal",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full transition-transform group-hover:scale-110"
                              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
                            />
                            <span className="truncate">{courseName}</span>
                          </span>
                          <span
                            className="shrink-0 text-[11px] font-normal tabular-nums"
                            style={{ color }}
                          >
                            {score != null ? `${Math.round(score)}%` : "—"}
                          </span>
                        </Link>
                      );
                    })}
                </div>
              </nav>
              <div className="mt-auto space-y-2 pt-4">
                <ReminderToggle />
                <ThemeToggle />
                <SignOutButton />
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export function MobileNav() {
  const pathname = useActivePath();
  const navItems = useNavItems();
  const locationHref = useRouterState({ select: (s) => s.location.href });
  const courses = useQuery(coursesQO);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [locationHref]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const current = navItems.find((i) => isActive(pathname, i.to))?.title ?? "CanvasPro";

  return (
    <div className="sticky top-0 z-40 md:hidden">
      <div className="glass-panel-strong relative z-40 mx-2 mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-2">
        <TrafficLights
          className="shrink-0"
          onRed={() => setOpen(false)}
          onYellow={() => setOpen((v) => !v)}
          onGreen={() => setOpen(true)}
        />
        <p className="truncate text-center text-sm font-normal tracking-tight text-foreground">
          {current}
        </p>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <ProfileButton />
          <ThemeToggle compact />
        </div>
      </div>

      {/* Scrim */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Collapsible panel — always mounted so it can animate */}
      <div
        className={cn(
          "glass-panel-strong relative z-40 mx-2 flex flex-col gap-1 overflow-y-auto p-2 transition-all duration-300 ease-in-out",
          open
            ? "mt-2 max-h-[calc(100dvh-6rem)] translate-y-0 opacity-100"
            : "pointer-events-none mt-0 max-h-0 -translate-y-2 overflow-hidden border-transparent p-0 opacity-0",
        )}
      >
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            preload="intent"
            onClick={() => setOpen(false)}
            className={cn(
              "press flex min-h-11 items-center rounded-xl px-3 text-sm font-normal",
              isActive(pathname, item.to)
                ? "bg-foreground/[0.08] text-foreground font-medium"
                : "text-muted-foreground",
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="truncate">{item.title}</span>
            </span>
          </Link>
        ))}

        <div className="my-2 flex items-center justify-center">
          <div className="h-[1px] w-20 rounded-full bg-white/10" />
        </div>

        <div className="flex flex-col gap-0.5">
          {courses.data &&
            courses.data.length > 0 &&
            courses.data.map((course: CourseSummary) => {
              const courseName = displayCourseNameForCourse(
                course.id,
                course.name,
                course.course_code,
              );
              const score = course.current_score;
              const color = getGradeColor(score);
              const coursePath = `/courses/${course.id}`;
              const active = pathname === coursePath;

              return (
                <Link
                  key={course.id}
                  to="/courses/$courseId"
                  params={{ courseId: String(course.id) }}
                  preload="intent"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "press flex min-h-10 items-center justify-between rounded-xl px-3 text-sm transition-all",
                    active
                      ? "bg-foreground/[0.08] text-foreground font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
                    />
                    <span className="truncate">{courseName}</span>
                  </span>
                  <span className="shrink-0 text-xs font-normal tabular-nums" style={{ color }}>
                    {score != null ? `${Math.round(score)}%` : "—"}
                  </span>
                </Link>
              );
            })}
        </div>

        <div className="mt-1 grid grid-cols-2 gap-2 pt-2">
          <ReminderToggle />
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
