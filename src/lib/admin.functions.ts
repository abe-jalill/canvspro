import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminEmail } from "@/lib/admin";
import {
  summarizeUsageActivity,
  utcDate,
  type ActivityRow,
  type UsagePeriod,
  type DailyCount,
} from "@/lib/usage-stats";

export type RecentUser = { label: string; lastSeenAt: string; interactions: number };

export type UsageStats = {
  activeToday: number;
  activeThisWeek: number;
  activeThisMonth: number;
  today: UsagePeriod;
  week: UsagePeriod;
  month: UsagePeriod;
  totalAccounts: number;
  daily: DailyCount[];
  recent: RecentUser[];
};

export const getUsageStatsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorize against the account's real email, not anything the client sent.
    const { data: me, error: meError } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    // A confirmed address only: an unverified sign-up can't claim an admin email.
    if (meError || !me?.user?.email_confirmed_at || !isAdminEmail(me.user.email)) {
      throw new Error("Forbidden");
    }

    const now = new Date();
    // Covers the 30-day chart and the rolling 7/30-day totals.
    const since = utcDate(now, -29);
    const { data: rows, error } = await supabaseAdmin
      .from("user_activity_daily")
      .select("user_id, activity_date, last_seen_at, interactions")
      .gte("activity_date", since)
      .order("last_seen_at", { ascending: false });
    if (error) throw new Error(error.message);

    const activity = (rows ?? []) as ActivityRow[];
    const latest = new Map<string, { lastSeenAt: string; interactions: number }>();
    const summary = summarizeUsageActivity(activity, now);

    for (const row of activity) {
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
      activeToday: summary.today.users,
      activeThisWeek: summary.week.users,
      activeThisMonth: summary.month.users,
      today: summary.today,
      week: summary.week,
      month: summary.month,
      totalAccounts: userList?.users.length ?? 0,
      daily: summary.daily,
      recent,
    };
  });
