import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronRight, Moon, Sun, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationCenter } from "@/components/notification-center";
import { StreakDetails, StreakFlame } from "@/components/streak";
import { useStreakSummary } from "@/hooks/use-streak";
import { useNotifications } from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import { useUserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

const rowClass =
  "glass-hover flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium";

/**
 * Phones: one profile button in the top bar. It opens light/dark mode, the
 * streak, notifications and My profile, so the bar stays uncluttered.
 */
export function MobileAccountMenu() {
  const { data: profile } = useUserProfile();
  const { unread } = useNotifications();
  const { theme, setMode } = useTheme();
  const streak = useStreakSummary();
  const [open, setOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const locationHref = useRouterState({ select: (s) => s.location.href });

  // Going to another page closes the menu.
  useEffect(() => {
    setOpen(false);
  }, [locationHref]);

  useEffect(() => {
    if (!open) setStreakOpen(false);
  }, [open]);

  const name = [profile?.nickname, profile?.firstName].map((v) => v?.trim()).find(Boolean);
  const avatarUrl = profile?.avatarUrl;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Account menu${unread ? `, ${unread} unread notifications` : ""}`}
            className="glass-hover glass-inset relative flex h-11 w-11 items-center justify-center rounded-xl"
          >
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            {unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-foreground"
              />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="max-h-[calc(100svh-6rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border-glass-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 px-2 pb-3 pt-2">
            <span className="glass-inset flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name || "Your account"}</p>
              {profile?.username && (
                <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
              )}
            </div>
          </div>

          <Link
            to="/settings/profile"
            preload="intent"
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            My profile
          </Link>

          <div className="mt-3 px-1">
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Appearance
            </p>
            <div
              role="radiogroup"
              aria-label="Appearance"
              className="glass-inset grid grid-cols-2 gap-1 rounded-xl p-1"
            >
              {(
                [
                  { mode: "light", label: "Light", Icon: Sun },
                  { mode: "dark", label: "Dark", Icon: Moon },
                ] as const
              ).map(({ mode, label, Icon }) => {
                const on = theme === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMode(mode)}
                    className={cn(
                      "flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
                      on ? "bg-foreground text-background" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 space-y-0.5">
            {streak && (
              <div>
                <button
                  type="button"
                  aria-expanded={streakOpen}
                  onClick={() => setStreakOpen((v) => !v)}
                  className={rowClass}
                >
                  <StreakFlame lit={streak.counted} className="h-5 w-4 shrink-0" />
                  <span className="flex-1">{streak.current} day streak</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      streakOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
                {streakOpen && (
                  <div className="glass-inset mx-1 mb-1 rounded-xl">
                    <StreakDetails />
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setNotificationsOpen(true);
              }}
              className={rowClass}
            >
              <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">Notifications</span>
              {unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-semibold tabular-nums text-background">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <NotificationCenter
        hideTrigger
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        className="contents"
      />
    </>
  );
}
