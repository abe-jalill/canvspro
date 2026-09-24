import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminEmail } from "@/lib/admin";

export type DailyCount = { date: string; users: number; interactions: number };
export type RecentUser = { label: string; lastSeenAt: string; interactions: number };

export type UsageStats = {
  activeToday: number;
  activeThisWeek: number;
  activeThisMonth: number;
  totalAccounts: number;
  daily: DailyCount[];
  recent: RecentUser[];
};

function utcDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export const getUsageStatsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorize against the account's real email, not anything the client sent.
    const { data: me, error: meError } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (meError || !isAdminEmail(me?.user?.email)) {
      throw new Error("Forbidden");
    }

    const since = utcDate(-29);
    const { data: rows, error } = await supabaseAdmin
      .from("user_activity_daily")
      .select("user_id, activity_date, last_seen_at, interactions")
      .gte("activity_date", since)
      .order("last_seen_at", { ascending: false });
    if (error) throw new Error(error.message);

    const activity = rows ?? [];
    const today = utcDate();
    const weekStart = utcDate(-6);
    const byDate = new Map<string, { users: Set<string>; interactions: number }>();
    const latest = new Map<string, { lastSeenAt: string; interactions: number }>();

    for (const row of activity) {
      const bucket = byDate.get(row.activity_date) ?? { users: new Set<string>(), interactions: 0 };
      bucket.users.add(row.user_id);
      bucket.interactions += row.interactions;
      byDate.set(row.activity_date, bucket);

      const existing = latest.get(row.user_id);
      if (!existing || existing.lastSeenAt < row.last_seen_at) {
        latest.set(row.user_id, {
          lastSeenAt: row.last_seen_at,
          interactions: (existing?.interactions ?? 0) + row.interactions,
        });
      } else {
        existing.interactions += row.interactions;
      }
    }

    const daily: DailyCount[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = utcDate(-i);
      const bucket = byDate.get(date);
      daily.push({ date, users: bucket?.users.size ?? 0, interactions: bucket?.interactions ?? 0 });
    }

    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emails = new Map<string, string>();
    for (const u of userList?.users ?? []) emails.set(u.id, u.email ?? "unknown");

    const recent: RecentUser[] = [...latest.entries()]
      .sort((a, b) => (a[1].lastSeenAt < b[1].lastSeenAt ? 1 : -1))
      .slice(0, 30)
      .map(([userId, info]) => ({
        label: emails.get(userId) ?? userId.slice(0, 8),
        lastSeenAt: info.lastSeenAt,
        interactions: info.interactions,
      }));

    return {
      activeToday: byDate.get(today)?.users.size ?? 0,
      activeThisWeek: new Set(
        activity.filter((r) => r.activity_date >= weekStart).map((r) => r.user_id),
      ).size,
      activeThisMonth: new Set(activity.map((r) => r.user_id)).size,
      totalAccounts: userList?.users.length ?? 0,
      daily,
      recent,
    };
  });
