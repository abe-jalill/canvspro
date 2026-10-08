// Is the closed-app notification pipeline working? GitHub Actions asks
// /api/public/push/health every hour (.github/workflows/push-health.yml) and
// emails the repo owner when the answer is no, so a silent failure is noticed
// within hours instead of days. Each rule below matches a real past outage.

/** UTC hours the background check runs (cron `*\/30 10-23,0-3`): 6 AM to midnight Eastern. */
export function inDispatchWindow(hourUtc: number): boolean {
  return hourUtc >= 10 || hourUtc <= 3;
}

const HALF_HOUR = 30 * 60_000;

/** The most recent :00 or :30 run that should have finished by `now` (5 minutes to finish). */
export function lastExpectedDispatch(now: number): number {
  let t = Math.floor((now - 5 * 60_000) / HALF_HOUR) * HALF_HOUR;
  while (!inDispatchWindow(new Date(t).getUTCHours())) t -= HALF_HOUR;
  return t;
}

/**
 * Outcomes that mean the pipeline is broken rather than one student's
 * settings: an unexpected error (a fetch option the host rejects), nothing
 * reaching any device (push keys), or Canvas refusing the request outright
 * (a firewall blocking our requests). A rejected key or quiet hours are not.
 */
export function isTroubleReason(reason: string | undefined): boolean {
  return reason === "error" || reason === "delivery-failed" || /^canvas-\d{3}$/.test(reason ?? "");
}

export interface AccountCheck {
  checkedAt: number;
  reason?: string;
  /** Consecutive checks of this account that ended in trouble. */
  failStreak: number;
}

/** Reads the heartbeat the background check stores per account (`push_last_check`). */
export function readAccountCheck(value: unknown): AccountCheck | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { checkedAt?: unknown; reason?: unknown; failStreak?: unknown };
  const checkedAt = typeof v.checkedAt === "string" ? Date.parse(v.checkedAt) : Number.NaN;
  if (!Number.isFinite(checkedAt)) return null;
  return {
    checkedAt,
    reason: typeof v.reason === "string" ? v.reason : undefined,
    failStreak: typeof v.failStreak === "number" && v.failStreak > 0 ? v.failStreak : 0,
  };
}

/** The next streak after a check ends with `reason`. */
export function nextFailStreak(previous: unknown, reason: string): number {
  return isTroubleReason(reason) ? (readAccountCheck(previous)?.failStreak ?? 0) + 1 : 0;
}

/** Two failed checks in a row (an hour) before raising the alarm, so one hiccup doesn't. */
const STREAK_TO_ALERT = 2;
/** Older heartbeats belong to accounts that are no longer checked (no devices left). */
const RECENT_MS = 3 * 60 * 60_000;

/**
 * Problem codes, empty when healthy.
 * - dispatch-not-running: no account was checked in the last expected run.
 * - dispatch-failing: checks keep ending in an error or reach no device.
 * - canvas-unreachable: Canvas refused every recently checked account.
 * - reminders-not-sending: class or tonight reminders came due and weren't sent.
 */
export function pushHealthProblems(input: {
  now: number;
  checks: AccountCheck[];
  overdueReminders: number;
}): string[] {
  const problems: string[] = [];
  const recent = input.checks.filter((c) => input.now - c.checkedAt <= RECENT_MS);
  const newest = input.checks.reduce((max, c) => Math.max(max, c.checkedAt), 0);
  if (input.checks.length > 0 && newest < lastExpectedDispatch(input.now) - 60_000) {
    problems.push("dispatch-not-running");
  }
  const failing = recent.filter((c) => c.failStreak >= STREAK_TO_ALERT);
  if (failing.some((c) => c.reason === "error" || c.reason === "delivery-failed")) {
    problems.push("dispatch-failing");
  }
  if (
    recent.length > 0 &&
    recent.every((c) => c.failStreak >= STREAK_TO_ALERT && /^canvas-\d{3}$/.test(c.reason ?? ""))
  ) {
    problems.push("canvas-unreachable");
  }
  if (input.overdueReminders > 0) problems.push("reminders-not-sending");
  return problems;
}
