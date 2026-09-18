import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, BellOff, Lock, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useReminders } from "@/hooks/use-hourly-reminder";
import { supabase } from "@/integrations/supabase/client";
import { NotificationCenter } from "@/components/notification-center";
import { useSubscription } from "@/lib/subscription";
import { isFreePath } from "@/components/pro-gate";
import { getCoursesFn, type CourseSummary } from "@/lib/canvas.functions";
import { displayCourseNameForCourse } from "@/lib/course-display";
import { getGradeColor } from "@/lib/grade-color";

const items = [
  { title: "Dashboard", to: "/dashboard" as const },
  { title: "Focus", to: "/focus" as const },
  { title: "Calendar", to: "/schedule" as const },
  { title: "Class Schedule", to: "/class-schedule" as const },
  { title: "Grades", to: "/grades" as const },
  { title: "Assignments", to: "/assignments" as const },
  { title: "Announcements", to: "/announcements" as const },
  { title: "Billing", to: "/billing" as const },
  { title: "Notifications", to: "/notifications" as const },
  { title: "Settings", to: "/settings" as const },
];

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
      {!compact && <span className="ml-2 text-xs font-medium">{enabled ? "Reminders on" : "Reminders off"}</span>}
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
      {!compact && <span className="ml-2 text-xs font-medium">{isDark ? "Light mode" : "Dark mode"}</span>}
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
  const courses = useQuery(coursesQO);

  return (
    <aside className="fixed left-4 top-4 bottom-4 z-30 hidden w-56 flex-col md:flex">
      <div className="glass-panel-strong flex h-full flex-col overflow-y-auto p-5">
        <Link
          to="/"
          preload="intent"
          className="mb-8 block px-2 press transition-opacity hover:opacity-80"
          aria-label="Go to homepage"
        >
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{"\n"}</span>
          <span className="mt-1 block text-base font-normal tracking-tight text-foreground">CanvasPro</span>
        </Link>
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => (
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
                <span className="flex items-center gap-2">
                  {isActive(pathname, item.to) && <span className="h-1 w-1 rounded-full bg-primary" />}
                  {item.title}
                </span>
                {!isPro && !isFreePath(item.to) && <Lock className="h-3.5 w-3.5 opacity-50" />}
              </span>
            </Link>
          ))}

          {/* Centered thin horizontal line separating Settings from enrolled classes */}
          <div className="my-2.5 flex items-center justify-center">
            <div className="h-[1px] w-20 bg-white/10 rounded-full" />
          </div>

          {/* List of all enrolled classes */}
          <div className="flex flex-col gap-0.5">
            {courses.data &&
              courses.data.length > 0 &&
              courses.data.map((course: CourseSummary) => {
                const courseName = displayCourseNameForCourse(course.id, course.name, course.course_code);
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
                      "press rounded-xl px-3 py-2 text-sm transition-all flex items-center justify-between gap-2 group",
                      active
                        ? "bg-foreground/[0.08] text-foreground font-medium shadow-sm"
                        : "text-muted-foreground/80 hover:bg-foreground/[0.04] hover:text-foreground font-normal",
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {/* Color indicator: closer to green for A, closer to red for 63 */}
                      <span
                        className="h-2 w-2 rounded-full shrink-0 transition-transform group-hover:scale-110"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 0 6px ${color}66`,
                        }}
                      />
                      <span className="truncate">{courseName}</span>
                    </span>
                    <span className="text-[11px] font-normal tabular-nums shrink-0" style={{ color }}>
                      {score != null ? `${Math.round(score)}%` : "—"}
                    </span>
                  </Link>
                );
              })}
          </div>
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
  const locationHref = useRouterState({ select: (s) => s.location.href });
  const { isActive: isPro } = useSubscription();
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
        <p className="truncate text-center text-sm font-normal tracking-tight text-foreground">{current}</p>
        <div className="flex items-center gap-2">
          {isPro && <NotificationCenter />}
          <ThemeToggle compact />
        </div>
      </div>

      {open && (
        <>
          <div aria-hidden onClick={() => setOpen(false)} className="fixed inset-0 z-30" />
          <div className="glass-panel-strong sticky top-[4.75rem] z-40 mx-2 mt-2 flex flex-col gap-1 p-2 max-h-[calc(100vh-6rem)] overflow-y-auto">
            {items.map((item) => (
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
                  {item.title}
                  {!isPro && !isFreePath(item.to) && <Lock className="h-3.5 w-3.5 opacity-60" />}
                </span>
              </Link>
            ))}

            {/* Centered thin separator line */}
            <div className="my-2 flex items-center justify-center">
              <div className="h-[1px] w-20 bg-white/10 rounded-full" />
            </div>

            {/* Mobile Enrolled classes */}
            <div className="flex flex-col gap-0.5">
              {courses.data &&
                courses.data.length > 0 &&
                courses.data.map((course: CourseSummary) => {
                  const courseName = displayCourseNameForCourse(course.id, course.name, course.course_code);
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
                        active ? "bg-foreground/[0.08] text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: color,
                            boxShadow: `0 0 6px ${color}66`,
                          }}
                        />
                        <span className="truncate">{courseName}</span>
                      </span>
                      <span className="text-xs font-normal tabular-nums shrink-0" style={{ color }}>
                        {score != null ? `${Math.round(score)}%` : "—"}
                      </span>
                    </Link>
                  );
                })}
            </div>

            <div className="mt-1 grid grid-cols-2 gap-2 pt-2">
              {isPro && <ReminderToggle />}
              <SignOutButton />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
