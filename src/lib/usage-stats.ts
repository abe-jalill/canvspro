export type ActivityRow = {
  user_id: string;
  activity_date: string;
  last_seen_at: string;
  interactions: number;
};

export type DailyCount = { date: string; users: number; interactions: number };

export type UsagePeriod = {
  users: number;
  interactions: number;
};

export type UsageSummary = {
  today: UsagePeriod;
  week: UsagePeriod;
  month: UsagePeriod;
  daily: DailyCount[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDate(date = new Date(), offsetDays = 0): string {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function utcWeekStart(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

export function utcMonthStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function period(rows: ActivityRow[], start: string, end: string): UsagePeriod {
  const users = new Set<string>();
  let interactions = 0;
  for (const row of rows) {
    if (row.activity_date < start || row.activity_date > end) continue;
    users.add(row.user_id);
    interactions += row.interactions;
  }
  return { users: users.size, interactions };
}

export function summarizeUsageActivity(
  rows: ActivityRow[],
  now = new Date(),
  dailyDays = 30,
): UsageSummary {
  const today = utcDate(now);
  const byDate = new Map<string, { users: Set<string>; interactions: number }>();

  for (const row of rows) {
    const bucket = byDate.get(row.activity_date) ?? { users: new Set<string>(), interactions: 0 };
    bucket.users.add(row.user_id);
    bucket.interactions += row.interactions;
    byDate.set(row.activity_date, bucket);
  }

  const daily: DailyCount[] = [];
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setTime(start.getTime() - (dailyDays - 1) * DAY_MS);
  for (let i = 0; i < dailyDays; i += 1) {
    const date = utcDate(start, i);
    const bucket = byDate.get(date);
    daily.push({ date, users: bucket?.users.size ?? 0, interactions: bucket?.interactions ?? 0 });
  }

  return {
    today: period(rows, today, today),
    // Rolling windows, so the 30-day figure always includes the 7-day one.
    // (Calendar week/month made "this month" smaller than "this week" in the
    // first days of a month.)
    week: period(rows, utcDate(now, -6), today),
    month: period(rows, utcDate(now, -29), today),
    daily,
  };
}
