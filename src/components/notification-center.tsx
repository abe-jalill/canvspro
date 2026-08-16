import { useEffect, useRef, useState } from "react";
import { Bell, Check, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/notifications";

function timeAgo(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function NotificationCenter({ className }: { className?: string }) {
  const { notifications, unread, markRead, markAllRead, remove, clear } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <>
          <div
            className="fixed inset-0 z-40 bg-background/70 sm:hidden"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            style={{ background: "hsl(var(--background) / 0.97)" }}
            className="glass-panel-strong fixed inset-x-3 top-[5.25rem] z-50 overflow-hidden p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
          >

          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Notifications
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                disabled={unread === 0}
                className="glass-hover flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground disabled:opacity-40"
                title="Mark all read"
              >
                <Check className="h-3 w-3" /> Read
              </button>
              <button
                onClick={clear}
                disabled={notifications.length === 0}
                className="glass-hover flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground disabled:opacity-40"
                title="Clear all"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground/80">
                You're all caught up.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      "glass-inset flex items-start gap-2 rounded-xl p-3",
                      !n.read && "bg-foreground/[0.06]",
                    )}
                  >
                    <button
                      onClick={() => markRead(n.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {timeAgo(n.ts)}
                      </p>
                    </button>
                    <button
                      onClick={() => remove(n.id)}
                      aria-label="Dismiss notification"
                      className="glass-hover flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </div>
        </>
      )}

    </div>
  );
}
