import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { GlassCard } from "@/components/glass-card";
import { getUsageStatsFn, type UsageStats } from "@/lib/admin.functions";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAuthUserId, userKey } from "@/lib/auth-user";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Usage — CanvasPro" },
      { name: "description", content: "Private usage overview for CanvasPro." },
      { property: "og:title", content: "Usage — CanvasPro" },
      { property: "og:description", content: "Private usage overview for CanvasPro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminUsagePage,
});

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function weekdayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-inset rounded-2xl px-4 py-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">{value}</p>
    </div>
  );
}

function ActivityChart({ daily, days }: { daily: UsageStats["daily"]; days: number }) {
  const slice = daily.slice(-days);
  const max = Math.max(1, ...slice.map((d) => d.users));
  return (
    <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: 160 }}>
      {slice.map((d) => (
        <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {d.users > 0 ? d.users : ""}
          </span>
          <div
            title={`${d.date}: ${d.users} active`}
            className={cn(
              "w-full rounded-t-md bg-foreground/70 transition-all",
              d.users === 0 && "bg-foreground/10",
            )}
            style={{ height: `${Math.max(3, (d.users / max) * 110)}px` }}
          />
          {days <= 7 && (
            <span className="text-[10px] text-muted-foreground">{weekdayLabel(d.date)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminUsagePage() {
  const navigate = useNavigate();
  const { isAdmin, isPending } = useIsAdmin();
  const { userId } = useAuthUserId();

  useEffect(() => {
    if (!isPending && !isAdmin) void navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, isPending, navigate]);

  const stats = useQuery({
    queryKey: userKey(["usage-stats"], userId),
    queryFn: () => getUsageStatsFn(),
    enabled: isAdmin,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (isPending || !isAdmin) return null;

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="px-1 pt-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Private
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">Usage</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          How many people actually opened CanvasPro, day by day. Only you can see this.
        </p>
      </header>

      {stats.isPending && (
        <GlassCard>
          <p className="text-sm text-muted-foreground">Loading usage…</p>
        </GlassCard>
      )}

      {stats.isError && (
        <GlassCard>
          <p className="text-sm text-muted-foreground">
            Could not load usage right now. Pull down or reload to try again.
          </p>
        </GlassCard>
      )}

      {stats.data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Active today" value={stats.data.activeToday} />
            <Stat label="Last 7 days" value={stats.data.activeThisWeek} />
            <Stat label="Last 30 days" value={stats.data.activeThisMonth} />
            <Stat label="Accounts" value={stats.data.totalAccounts} />
          </div>

          <GlassCard strong title="Last 7 days" subtitle="People who used the app each day.">
            <ActivityChart daily={stats.data.daily} days={7} />
          </GlassCard>

          <GlassCard title="Last 30 days" subtitle="Longer trend, one bar per day.">
            <ActivityChart daily={stats.data.daily} days={30} />
          </GlassCard>

          <GlassCard title="Recently active" subtitle="Most recent first.">
            {stats.data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {stats.data.recent.map((row) => (
                  <li
                    key={row.label + row.lastSeenAt}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm">{row.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {relativeTime(row.lastSeenAt)} · {row.interactions} visits
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
