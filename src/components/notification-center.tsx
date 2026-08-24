import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, ChevronRight, Trash2, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useNotifications, type AppNotification } from "@/lib/notifications";

const PER_GROUP = 3;

type FilterKind = "due" | "overdue" | "grade" | "announcement";

const FILTERS: Array<{ id: FilterKind; label: string }> = [
  { id: "due", label: "Due" },
  { id: "overdue", label: "Overdue" },
  { id: "grade", label: "Grades" },
  { id: "announcement", label: "Announcements" },
];

function timeAgo(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function routeFor(n: AppNotification) {
  if (n.to) return n.to;
  if (n.kind === "grade") return "/grades";
  if (n.kind === "announcement") return "/announcements";
  if (n.kind === "due" || n.kind === "overdue") return "/assignments";
  return null;
}

export function NotificationCenter({ className }: { className?: string }) {
  const { notifications, unread, markRead, markAllRead, remove, clear } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<FilterKind[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(
    () =>
      active.length === 0
        ? notifications
        : notifications.filter((n) =>
            active.includes(n.kind as FilterKind),
          ),
    [notifications, active],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of notifications) c[n.kind] = (c[n.kind] ?? 0) + 1;
    return c;
  }, [notifications]);

  const groups = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    for (const n of filtered) {
      const key = n.course?.trim() || "General";
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .filter(([, items]) => items.length > 0)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function openNotification(n: AppNotification) {
    markRead(n.id);
    const to = routeFor(n);
    if (to) {
      setOpen(false);
      navigate({
        to,
        search: n.course ? { course: n.course } : {},
      } as never);
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className="glass-hover glass-inset relative flex h-11 w-11 items-center justify-center rounded-xl"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold tabular-nums text-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-panel-strong absolute right-0 z-50 mt-2 w-[min(30rem,calc(100vw-1.5rem))] overflow-hidden p-3">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Notifications
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                disabled={unread === 0}
                className="glass-hover flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-muted-foreground disabled:opacity-40"
                title="Mark all read"
              >
                <Check className="h-3.5 w-3.5" /> Read
              </button>
              <button
                onClick={clear}
                disabled={notifications.length === 0}
                className="glass-hover flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-muted-foreground disabled:opacity-40"
                title="Clear all"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          </div>

          <div
            role="group"
            aria-label="Filter notifications"
            className="flex flex-wrap gap-1.5 px-1 pb-3"
          >
            {FILTERS.map((f) => {
              const on = active.includes(f.id);
              return (
                <button
                  key={f.id}
                  aria-pressed={on}
                  onClick={() =>
                    setActive((prev) =>
                      prev.includes(f.id)
                        ? prev.filter((x) => x !== f.id)
                        : [...prev, f.id],
                    )
                  }
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
                    on
                      ? "bg-foreground text-background"
                      : "glass-inset glass-hover text-muted-foreground",
                  )}
                >
                  {f.label}
                  {counts[f.id] ? (
                    <span className="ml-1 tabular-nums opacity-60">
                      {counts[f.id]}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {active.length > 0 && (
              <button
                onClick={() => setActive([])}
                className="glass-hover rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground"
              >
                All
              </button>
            )}
          </div>

          <div className="no-scrollbar max-h-[70vh] overflow-y-auto">
            {groups.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground/80">
                You're all caught up.
              </p>
            ) : (
              <div className="space-y-4">
                {groups.map(([course, items]) => {
                  const isOpen = expanded[course];
                  const shown = isOpen ? items : items.slice(0, PER_GROUP);
                  const groupUnread = items.filter((n) => !n.read).length;
                  return (
                    <section key={course}>
                      <header className="flex items-center justify-between gap-2 px-1 pb-1.5">
                        <h3 className="min-w-0 truncate text-sm font-semibold tracking-tight">
                          {course}
                        </h3>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {groupUnread > 0
                            ? `${groupUnread} new · ${items.length}`
                            : items.length}
                        </span>
                      </header>
                      <ul className="space-y-2">
                        {shown.map((n) => (
                          <li
                            key={n.id}
                            className={cn(
                              "glass-inset glass-hover flex items-start gap-2 rounded-xl p-4",
                              !n.read && "bg-foreground/[0.06]",
                            )}
                          >
                            <button
                              onClick={() => openNotification(n)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="text-sm font-medium leading-snug">
                                {n.title}
                              </p>
                              {n.body && (
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {n.body}
                                </p>
                              )}
                              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                                {timeAgo(n.ts)}
                                {routeFor(n) && (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </p>
                            </button>
                            <button
                              onClick={() => remove(n.id)}
                              aria-label="Dismiss notification"
                              className="glass-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      {items.length > PER_GROUP && (
                        <button
                          onClick={() =>
                            setExpanded((p) => ({ ...p, [course]: !p[course] }))
                          }
                          className="glass-hover mt-2 w-full rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground"
                        >
                          {isOpen
                            ? "See less"
                            : `See more (${items.length - PER_GROUP})`}
                        </button>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
