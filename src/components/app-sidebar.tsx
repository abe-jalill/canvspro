import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  BellOff,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Settings,
  Sun,
  TimerReset,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTheme } from "@/lib/theme";
import { useReminders } from "@/hooks/use-hourly-reminder";
import { supabase } from "@/integrations/supabase/client";
import { NotificationCenter } from "@/components/notification-center";
import { useSignOut } from "@/hooks/use-sign-out";
import { ProfileButton } from "@/components/profile-button";
import { MobileAccountMenu } from "@/components/mobile-account-menu";
import { TrafficLights } from "@/components/traffic-lights";
import type { CourseSummary } from "@/lib/canvas.functions";
import { displayCourseNameForCourse } from "@/lib/course-display";
import { getGradeColor } from "@/lib/grade-color";
import { classColor } from "@/lib/class-color";
import { useSidebarMode } from "@/lib/sidebar-state";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { SlidingSidebarNav } from "@/components/sliding-sidebar-nav";

const items = [
  { title: "Today", to: "/dashboard" as const, icon: LayoutDashboard },
  { title: "To-Do", to: "/focus" as const, icon: ListTodo },
  { title: "Study Session", to: "/study-session" as const, icon: TimerReset },
  { title: "Calendar", to: "/schedule" as const, icon: CalendarDays },
  { title: "Grades", to: "/grades" as const, icon: GraduationCap },
  { title: "Assignments", to: "/assignments" as const, icon: ListChecks },
  { title: "Announcements", to: "/announcements" as const, icon: Megaphone },
  { title: "Settings", to: "/settings" as const, icon: Settings },
];

const adminItem = { title: "Usage", to: "/admin" as const, icon: BarChart3 };

/** Nav entries for this account — the usage screen only exists for the owner. */
function useNavItems() {
  const { isAdmin } = useIsAdmin();
  return isAdmin ? [...items, adminItem] : items;
}

import { coursesQueryOptions as coursesQO, prefetchRouteQueries } from "@/lib/canvas.queries";

function useActivePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

// Pages reached through in-page tabs keep their parent sidebar entry lit.
const NESTED_PATHS: Record<string, string[]> = {
  "/schedule": ["/class-schedule"],
};

/** "Introduction to Psychology" → "IP", "Calculus I" → "CI". */
function classInitials(name: string) {
  const words = name
    .split(/[\s:–-]+/)
    .filter((word) => word && !/^(to|of|and|the|for|in|a|an|&)$/i.test(word));
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/** Pages outside the sidebar, named in the phone header. */
const PAGE_TITLES: Record<string, string> = {
  "/new-grades": "New grades",
  "/completed": "Completed",
  "/study-session": "Study Session",
  "/notifications": "Notifications",
  "/class-schedule": "My classes",
};

function isItemActive(pathname: string, to: string) {
  return isActive(pathname, to) || (NESTED_PATHS[to] ?? []).some((p) => isActive(pathname, p));
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
      title={enabled ? "Hourly reminders on (9 AM – 9 PM)" : "Hourly reminders off"}
    >
      {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      {!compact && (
        <span className="ml-2 text-xs font-medium">
          {enabled ? "Hourly reminders on" : "Hourly reminders off"}
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

function SignOutButton({ compact = false }: { compact?: boolean }) {
  const signOut = useSignOut();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        onClick={() => setConfirming(true)}
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
      {/* One mis-click shouldn't sign anyone out. */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of CoursePro?</AlertDialogTitle>
            <AlertDialogDescription>
              Your work stays in your account. This browser stops getting notifications until you
              sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium transition hover:bg-foreground/5"
            >
              Stay signed in
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                void signOut();
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-destructive px-4 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
            >
              Sign out
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AppSidebar() {
  const queryClient = useQueryClient();
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
        // Only reachable (by mouse or keyboard) while the sidebar is closed.
        inert={!hidden}
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
        inert={hidden}
      >
        <div
          className={cn(
            "sidebar-scroll glass-panel-strong flex h-full flex-col overflow-y-auto transition-[padding] duration-300",
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
              <SlidingSidebarNav
                activeKey={pathname}
                itemCount={navItems.length + (courses.data?.length ?? 0)}
                className="flex w-full flex-col items-center gap-1"
              >
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(pathname, item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      preload="intent"
                      onMouseEnter={() => prefetchRouteQueries(queryClient, item.to)}
                      onFocus={() => prefetchRouteQueries(queryClient, item.to)}
                      title={item.title}
                      aria-label={item.title}
                      aria-current={active ? "page" : undefined}
                      data-sidebar-active={active}
                      className={cn(
                        "sidebar-nav-link relative z-10 flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                        active
                          ? "text-foreground"
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
                  const color = classColor(
                    course.id,
                    (courses.data ?? []).map((c) => c.id),
                  );
                  const coursePath = `/courses/${course.id}`;
                  return (
                    <Link
                      key={course.id}
                      to="/courses/$courseId"
                      params={{ courseId: String(course.id) }}
                      preload="intent"
                      onMouseEnter={() => prefetchRouteQueries(queryClient, coursePath)}
                      onFocus={() => prefetchRouteQueries(queryClient, coursePath)}
                      title={courseName}
                      aria-label={courseName}
                      aria-current={pathname === coursePath ? "page" : undefined}
                      data-sidebar-active={pathname === coursePath}
                      className={cn(
                        "sidebar-nav-link relative z-10 flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                        pathname !== coursePath && "hover:bg-foreground/[0.04]",
                      )}
                    >
                      {/* The class's initials in its own color, so five classes
                          aren't five identical dots. */}
                      <span
                        className="grid h-7 w-7 place-items-center rounded-lg text-[10px] font-semibold"
                        style={{
                          color,
                          backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                        }}
                        aria-hidden="true"
                      >
                        {classInitials(courseName)}
                      </span>
                    </Link>
                  );
                })}
              </SlidingSidebarNav>
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
                  <span className="app-brand">coursepro.</span>
                </Link>
                <TrafficLights
                  className="relative z-10 shrink-0"
                  onRed={() => setMode("hidden")}
                  onYellow={() => setMode("rail")}
                  onGreen={() => setMode("full")}
                />
              </div>
              <SlidingSidebarNav
                activeKey={pathname}
                itemCount={navItems.length + (courses.data?.length ?? 0)}
                className="flex flex-col gap-0.5"
              >
                {navItems.map((item) => {
                  const active = isItemActive(pathname, item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      preload="intent"
                      onMouseEnter={() => prefetchRouteQueries(queryClient, item.to)}
                      onFocus={() => prefetchRouteQueries(queryClient, item.to)}
                      aria-current={active ? "page" : undefined}
                      data-sidebar-active={active}
                      className={cn(
                        "sidebar-nav-link relative z-10 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground/80 hover:bg-foreground/[0.04] hover:text-foreground",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "h-1 w-1 shrink-0 rounded-full bg-primary transition-[opacity,transform] duration-200",
                              active ? "scale-100 opacity-100" : "scale-50 opacity-0",
                            )}
                          />
                          <span className="truncate">{item.title}</span>
                        </span>
                      </span>
                    </Link>
                  );
                })}

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
                          onMouseEnter={() => prefetchRouteQueries(queryClient, coursePath)}
                          onFocus={() => prefetchRouteQueries(queryClient, coursePath)}
                          title={`${courseName} (${score != null ? score.toFixed(1) + "%" : "No grade"})`}
                          aria-current={active ? "page" : undefined}
                          data-sidebar-active={active}
                          className={cn(
                            "sidebar-nav-link group relative z-10 flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "text-foreground"
                              : "text-muted-foreground/80 hover:bg-foreground/[0.04] hover:text-foreground",
                          )}
                        >
                          {/* A long class name wraps instead of being cut off. */}
                          <span className="flex min-w-0 items-start gap-2">
                            <span
                              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full opacity-80"
                              style={{ backgroundColor: color }}
                            />
                            <span className="leading-5">{courseName}</span>
                          </span>
                          <span className="shrink-0 text-[11px] font-normal leading-5 tabular-nums text-muted-foreground">
                            {score != null ? `${Math.round(score)}%` : "—"}
                          </span>
                        </Link>
                      );
                    })}
                </div>
              </SlidingSidebarNav>
              <div className="mt-auto flex items-center justify-center gap-2 pt-4">
                <ReminderToggle compact />
                <ThemeToggle compact />
                <SignOutButton compact />
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export function MobileNav() {
  const queryClient = useQueryClient();
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

  // The page's own name: its sidebar entry, a class's name, or a page opened
  // from another one. "CoursePro" only when there's nothing better.
  const courseId = /^\/courses\/(\d+)/.exec(pathname)?.[1];
  const course = courseId ? courses.data?.find((c) => String(c.id) === courseId) : undefined;
  // A page's own name wins over the section it sits under (My classes, not Calendar).
  const current =
    PAGE_TITLES[pathname] ??
    navItems.find((i) => isItemActive(pathname, i.to))?.title ??
    (course ? displayCourseNameForCourse(course.id, course.name, course.course_code) : null) ??
    "CoursePro";

  return (
    <div className="mobile-navigation sticky top-0 z-40 md:hidden">
      <div className="glass-panel-strong relative z-40 mx-2 mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-2">
        {/* A plain Menu button: the one way to every page on a phone, so it must be obvious. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground hover:bg-foreground/5"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          <span>Menu</span>
        </button>
        <p className="truncate text-center text-sm font-normal tracking-tight text-foreground">
          {current}
        </p>
        <div className="flex items-center justify-end">
          <MobileAccountMenu />
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
        inert={!open}
        aria-hidden={!open}
        className={cn(
          "mobile-navigation-panel glass-panel-strong absolute inset-x-0 top-full z-40 mx-2 mt-2 flex max-h-[calc(100dvh-6rem)] flex-col gap-1 overflow-y-auto overscroll-contain p-2 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            preload="intent"
            onMouseEnter={() => prefetchRouteQueries(queryClient, item.to)}
            onFocus={() => prefetchRouteQueries(queryClient, item.to)}
            onClick={() => setOpen(false)}
            className={cn(
              "press flex min-h-11 items-center rounded-xl px-3 text-sm font-normal",
              isItemActive(pathname, item.to)
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
                  onMouseEnter={() => prefetchRouteQueries(queryClient, coursePath)}
                  onFocus={() => prefetchRouteQueries(queryClient, coursePath)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "press flex min-h-10 items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-all",
                    active
                      ? "bg-foreground/[0.08] text-foreground font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="flex min-w-0 items-start gap-2">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 6px color-mix(in srgb, ${color} 40%, transparent)` }}
                    />
                    <span className="leading-5">{courseName}</span>
                  </span>
                  <span className="shrink-0 text-xs font-normal leading-5 tabular-nums" style={{ color }}>
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
