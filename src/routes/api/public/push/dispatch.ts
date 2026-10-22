import { createFileRoute } from "@tanstack/react-router";
import { completedAssignmentIds } from "@/lib/completion-records";
import { PUSH_HEARTBEAT_PREF, lastServerCheck } from "@/lib/push-heartbeat";
import { nextFailStreak } from "@/lib/push-health";
import {
  buildAlertsForUser,
  deliver,
  type BuildStats,
  isAllowedCanvasHost,
  isPushServiceEndpoint,
  isQuiet,
  normalizeCanvasDomain,
  scheduledAlertAllowed,
  SERVER_DEFAULT_PREFS,
  type Alert,
  type ServerPrefs,
} from "@/lib/push-dispatch.server";
import {
  buildClassCountdownAlerts,
  buildStreakAlert,
  buildTonightAlerts,
  planScheduledAlerts,
  type ScheduledAlertRow,
  type ScheduleRow,
  type StreakRow,
  type TonightItem,
} from "@/lib/countdown-alerts.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nativeAlertAllowed, nativeDelivered } from "@/lib/native-push";

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count?: number;
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** Compares two secrets without leaking per-character timing. */
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  // Always walk the longer buffer so the loop length never depends on a match.
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * Queues the user's upcoming countdown pushes (next class, tonight's deadlines).
 * They are sent by the separate 5-minute "scheduled" run at their exact time:
 * this check only runs every 30 minutes, so sending them here made a
 * "starts in 15 min" reminder land when class began.
 */
async function enqueueCountdowns(
  admin: Admin,
  userId: string,
  prefs: ServerPrefs,
  tz: number,
  tonight: TonightItem[],
): Promise<void> {
  if (!prefs.countdownClass && !prefs.countdownTonight) return;
  const now = new Date();

  const rows: ScheduledAlertRow[] = [];
  if (prefs.countdownClass) {
    const { data: entries } = await admin
      .from("class_schedule_entries")
      .select("title,days,start_minutes,end_minutes,location")
      .eq("user_id", userId);
    rows.push(...buildClassCountdownAlerts((entries ?? []) as ScheduleRow[], prefs, tz, now));
  }
  rows.push(...buildTonightAlerts(tonight, prefs, tz, now));

  if (rows.length > 0) {
    await admin.from("push_scheduled_alerts").upsert(
      rows.map((r) => ({ ...r, user_id: userId })),
      { onConflict: "user_id,tag", ignoreDuplicates: true },
    );
  }

  // Old rows are pruned so the table stays small.
  await admin
    .from("push_scheduled_alerts")
    .delete()
    .eq("user_id", userId)
    .lt("fire_at", new Date(now.getTime() - 3 * 86_400_000).toISOString());
}

/** `user_streaks` isn't in the generated types yet. */
function streakDb(admin: Admin): SupabaseClient {
  return admin as unknown as SupabaseClient;
}

/**
 * Queues today's 6 PM "Don't break your streak!!!" when the student's streak
 * ends at midnight and they haven't opened CoursePro today. Best-effort: a
 * failed read (or the streak table not deployed yet) never stops the account's
 * other alerts or changes the check's reason.
 */
async function enqueueStreakReminder(
  admin: Admin,
  userId: string,
  prefs: ServerPrefs,
  tz: number,
): Promise<void> {
  if (!prefs.streakReminder) return;
  try {
    const { data, error } = await streakDb(admin)
      .from("user_streaks")
      .select("current_streak,last_active_on,freeze_used_on")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return;
    const row = buildStreakAlert((data as StreakRow | null) ?? null, prefs, tz);
    if (!row) return;
    await admin
      .from("push_scheduled_alerts")
      .upsert({ ...row, user_id: userId }, { onConflict: "user_id,tag", ignoreDuplicates: true });
  } catch (err) {
    console.warn(
      `[push-dispatch] streak reminder skipped user=${userId} (${err instanceof Error ? err.message : err})`,
    );
  }
}

/**
 * Each account's latest active day, for the streak reminders about to go out:
 * one opened CoursePro after it was queued is not sent. Null when the lookup
 * failed, so those reminders wait for the next run instead of guessing.
 */
async function streakActiveDays(
  admin: Admin,
  userIds: string[],
): Promise<Map<string, string | null> | null> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await streakDb(admin)
    .from("user_streaks")
    .select("user_id,last_active_on")
    .in("user_id", userIds);
  if (error) {
    console.error("[push-scheduled] streak lookup failed", error.message);
    return null;
  }
  return new Map(
    ((data ?? []) as Array<{ user_id: string; last_active_on: string | null }>).map((r) => [
      r.user_id,
      r.last_active_on,
    ]),
  );
}

/**
 * How late a queued countdown may go out with the text it was queued with. The
 * scheduled run fires every 5 minutes; past this, the countdown would read
 * wrong ("starts in 15 min" when class starts in 5), so a run that was missed
 * sends it with the time recalculated, or drops it once class has started
 * (planScheduledAlerts).
 */
const SCHEDULED_GRACE_MS = 6 * 60_000;
/** How far back the scheduled run looks for reminders a missed run left unsent. */
const SCHEDULED_LOOKBACK_MS = 12 * 3_600_000;

/**
 * New grades and announcements to the account's iPhones, through the apns
 * function (Apple's push service needs HTTP/2, which Workers' fetch can't
 * promise). Returns the alert ids at least one iPhone got. Best-effort: Apple
 * push not set up yet, or any error, sends nothing and leaves web push alone.
 */
async function deliverToIphones(
  admin: Admin,
  userId: string,
  alerts: Alert[],
  cronSecret: string,
): Promise<Set<string>> {
  const wanted = alerts.filter((a) => nativeAlertAllowed(a.id));
  if (wanted.length === 0) return new Set();
  try {
    const { data, error } = await admin.functions.invoke("apns", {
      body: {
        user_id: userId,
        alerts: wanted.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          to: a.to,
          badge: a.badge,
        })),
      },
      headers: { "x-cron-secret": cronSecret },
    });
    if (error) {
      console.warn(`[push-dispatch] iphone push failed user=${userId} (${error.message})`);
      return new Set();
    }
    return nativeDelivered(
      data,
      wanted.map((a) => a.id),
    );
  } catch (err) {
    console.warn(
      `[push-dispatch] iphone push failed user=${userId} (${err instanceof Error ? err.message : err})`,
    );
    return new Set();
  }
}

/**
 * Sends the alerts this account hasn't had yet to its devices, records what
 * went out, and tidies up dead or failing subscriptions. `iphone` carries the
 * cron secret when the account has the iPhone app registered; an alert counts
 * as delivered when a browser or an iPhone got it.
 */
async function deliverToUser(
  admin: Admin,
  userId: string,
  userSubs: SubRow[],
  due: Alert[],
  vapid: Vapid,
  iphone: { cronSecret: string } | null = null,
): Promise<{ sent: number; failures: number; fresh: number; logged: string[] }> {
  // `logged`: alerts this account has now had, sent earlier or just now.
  const out = { sent: 0, failures: 0, fresh: 0, logged: [] as string[] };
  // Only real browser push services; a hand-written endpoint is never contacted.
  userSubs = userSubs.filter((s) => isPushServiceEndpoint(s.endpoint));
  if (due.length === 0 || (userSubs.length === 0 && !iphone)) return out;
  const { data: sentRows } = await admin
    .from("push_sent_log")
    .select("alert_id")
    .eq("user_id", userId)
    .in(
      "alert_id",
      due.map((a) => a.id),
    );
  const already = new Set((sentRows ?? []).map((r) => r.alert_id as string));
  out.logged = due.filter((a) => already.has(a.id)).map((a) => a.id);
  const fresh = due.filter((a) => !already.has(a.id)).slice(0, 12);
  out.fresh = fresh.length;
  if (fresh.length === 0) return out;

  const dead = new Set<string>();
  const failedSubs = new Set<string>();
  const okSubs = new Set<string>();
  const loggable: typeof fresh = [];
  const onIphone = iphone
    ? await deliverToIphones(admin, userId, fresh, iphone.cronSecret)
    : new Set<string>();
  for (const alert of fresh) {
    if (onIphone.has(alert.id)) {
      loggable.push(alert);
      out.sent += 1;
      // Browsers still get it below when there are any; it's logged once.
    }
    const targets = userSubs.filter((s) => !dead.has(s.id));
    if (targets.length === 0) {
      if (onIphone.has(alert.id)) continue;
      if (userSubs.length === 0) continue;
      break;
    }
    const report = await deliver(targets, alert, vapid);
    report.dead.forEach((id) => dead.add(id));
    report.failed.forEach((id) => failedSubs.add(id));
    report.delivered.forEach((id) => okSubs.add(id));
    if (onIphone.has(alert.id)) continue;
    if (report.delivered.length > 0) {
      loggable.push(alert);
      out.sent += 1;
    } else {
      out.failures += 1;
      console.error(
        `[push-dispatch] alert not delivered user=${userId} alert=${alert.id} targets=${targets.length}`,
      );
    }
  }

  // Only mark alerts as sent when at least one device actually got them,
  // so a transient outage doesn't permanently suppress the notification.
  if (loggable.length > 0) {
    await admin
      .from("push_sent_log")
      .upsert(loggable.map((a) => ({ user_id: userId, alert_id: a.id })));
    out.logged.push(...loggable.map((a) => a.id));
  }
  if (dead.size > 0) {
    console.warn(`[push-dispatch] removing ${dead.size} expired subscription(s) user=${userId}`);
    await admin.from("push_subscriptions").delete().in("id", Array.from(dead));
  }
  if (okSubs.size > 0) {
    await admin
      .from("push_subscriptions")
      .update({ failure_count: 0, last_success_at: new Date().toISOString() })
      .in("id", Array.from(okSubs));
  }
  for (const id of failedSubs) {
    if (okSubs.has(id)) continue;
    const row = userSubs.find((s) => s.id === id);
    await admin
      .from("push_subscriptions")
      .update({ failure_count: (row?.failure_count ?? 0) + 1 })
      .eq("id", id);
  }
  return out;
}

export const CANVAS_KEY_STATUS_PREF = "canvas_key_status";

/**
 * The student's class nicknames, so alerts name classes the way the app does.
 * Best-effort: if they can't be read, alerts use the Canvas names and still go out.
 */
async function classNicknames(admin: Admin, userId: string): Promise<Map<number, string>> {
  try {
    const { data, error } = await admin
      .from("class_nicknames")
      .select("canvas_course_id,custom_name")
      .eq("user_id", userId);
    if (error) return new Map();
    const names = new Map<number, string>();
    for (const row of data ?? []) {
      const name = (row.custom_name ?? "").trim();
      if (name) names.set(Number(row.canvas_course_id), name);
    }
    return names;
  } catch {
    return new Map();
  }
}

async function setCanvasKeyStatus(admin: Admin, userId: string, status: number): Promise<void> {
  await admin.from("user_preferences").upsert(
    {
      user_id: userId,
      key: CANVAS_KEY_STATUS_PREF,
      value: { invalid: true, status, at: new Date().toISOString() },
    },
    { onConflict: "user_id,key" },
  );
}

async function clearCanvasKeyStatus(admin: Admin, userId: string): Promise<void> {
  await admin
    .from("user_preferences")
    .delete()
    .eq("user_id", userId)
    .eq("key", CANVAS_KEY_STATUS_PREF);
}

type Vapid = { publicKey: string; privateKey: string; subject: string };

/** Accounts checked at the same time when one request handles everyone. */
const USER_CONCURRENCY = 4;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Records that the background check looked at this account just now, how it
 * ended, and how many checks in a row ended in trouble. The hourly health
 * check (/api/public/push/health) reads these to notice a broken pipeline.
 */
async function recordHeartbeat(
  admin: Admin,
  userId: string,
  reason: string,
  previous: unknown,
): Promise<void> {
  const value = {
    checkedAt: new Date().toISOString(),
    reason,
    failStreak: nextFailStreak(previous, reason),
  };
  const { error } = await admin
    .from("user_preferences")
    .upsert({ user_id: userId, key: PUSH_HEARTBEAT_PREF, value }, { onConflict: "user_id,key" });
  if (error) console.warn(`[push-dispatch] heartbeat failed user=${userId} (${error.message})`);
}

/** What happened for one account. Counts and a reason only, so the cron log
 *  (net._http_response) shows exactly where a check stopped. */
interface DispatchResult {
  sent: number;
  failures: number;
  reason: string;
  stats?: BuildStats;
  /** Which Canvas host was called and what it answered (never the token). */
  canvas?: { host: string; answer: string };
  due?: number;
  fresh?: number;
}

/** Builds and delivers one account's due alerts. */
async function dispatchUser(
  admin: Admin,
  userId: string,
  userSubs: SubRow[],
  vapid: Vapid,
  defaultDomain: string,
  iphone: { cronSecret: string } | null = null,
): Promise<DispatchResult> {
  const result: DispatchResult = { sent: 0, failures: 0, reason: "error" };
  // An account with only the iPhone app: the phone schedules its own due-date,
  // class, tonight and streak reminders, so only grades and announcements are sent.
  const iphoneOnly = iphone !== null && !userSubs.some((s) => isPushServiceEndpoint(s.endpoint));
  let previousHeartbeat: unknown;
  try {
    const [
      { data: prefRow },
      { data: settings },
      { data: preferenceRows, error: preferenceError },
    ] = await Promise.all([
      admin
        .from("notification_prefs")
        .select("prefs,timezone_offset_minutes")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("user_settings")
        .select("canvas_api_key,canvas_domain")
        .eq("user_id", userId)
        .maybeSingle(),
      admin.from("user_preferences").select("key,value").eq("user_id", userId),
    ]);

    if (preferenceError) throw preferenceError;
    const userPreferences = Object.fromEntries(
      (preferenceRows ?? []).map((row) => [row.key, row.value]),
    );
    previousHeartbeat = userPreferences[PUSH_HEARTBEAT_PREF];
    const hiddenRow = { value: userPreferences.hidden_course_ids };

    const hiddenIds = new Set<number>(
      Array.isArray(hiddenRow?.value)
        ? (hiddenRow.value as unknown[]).map((v) => Number(v)).filter((n) => Number.isFinite(n))
        : [],
    );

    const token = (settings?.canvas_api_key ?? "").trim();
    if (!token) {
      result.reason = "no-canvas-key";
      return result;
    }
    // The student's own school URL, falling back to the global default for
    // accounts saved before per-school URLs existed.
    const userDomain = normalizeCanvasDomain(settings?.canvas_domain) || defaultDomain;
    if (!userDomain) {
      result.reason = "no-canvas-domain";
      return result;
    }
    const configuredDomains = [
      defaultDomain,
      ...(process.env["CANVAS_ALLOWED_DOMAINS"] ?? "").split(","),
    ];
    if (!isAllowedCanvasHost(userDomain, configuredDomains)) {
      result.reason = "canvas-domain-not-allowed";
      return result;
    }

    const prefs: ServerPrefs = {
      ...SERVER_DEFAULT_PREFS,
      ...((prefRow?.prefs ?? {}) as Partial<ServerPrefs>),
    };
    if (!prefs.enabled || !prefs.browserPush) {
      result.reason = "alerts-off";
      return result;
    }
    const tz = prefRow?.timezone_offset_minutes ?? 0;

    // Old dedupe records: an alert can only repeat within its own window
    // (a due date at most a week out, grades and announcements within a day).
    await admin
      .from("push_sent_log")
      .delete()
      .eq("user_id", userId)
      .lt("sent_at", new Date(Date.now() - 14 * 86_400_000).toISOString());

    // Class reminders need only the saved schedule, so they are queued before
    // quiet hours or a Canvas outage can stop this check. Quiet hours are
    // applied again when each one is sent.
    if (!iphoneOnly) {
      await enqueueCountdowns(admin, userId, { ...prefs, countdownTonight: false }, tz, []);
      // The streak reminder needs no Canvas data either.
      await enqueueStreakReminder(admin, userId, prefs, tz);
    }

    if (isQuiet(prefs, tz)) {
      result.reason = "quiet-hours";
      return result;
    }

    let alerts: Alert[];
    let tonight: TonightItem[];
    try {
      const built = await buildAlertsForUser(
        userDomain,
        token,
        prefs,
        tz,
        hiddenIds,
        completedAssignmentIds(userPreferences),
        await classNicknames(admin, userId),
      );
      alerts = built.alerts;
      tonight = built.tonight;
      result.stats = built.stats;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Canvas rejecting the stored token is a user-fixable problem, not a
      // server fault: flag it so the app can ask for a fresh key instead of
      // failing silently every 15 minutes.
      // Canvas uses 403 both for a bad token AND for throttling
      // ("Rate Limit Exceeded"), and 403 also appears for courses the
      // student simply can't read. Only a real authentication rejection
      // should ask the user for a new key.
      // A firewall or proxy HTML page ("Not Authorized") is not Canvas judging
      // the token, so it must never flag the student's key as invalid.
      const isHtmlPage = /<!doctype html|<html/i.test(message);
      const authRejected =
        !isHtmlPage &&
        (/Canvas 401/.test(message) ||
          (/Canvas 403/.test(message) &&
            /invalid access token|unauthori[sz]ed|not authori[sz]ed|valid user id|insufficient scopes|revoked|expired/i.test(
              message,
            )));
      if (authRejected) {
        await setCanvasKeyStatus(admin, userId, message.includes("401") ? 401 : 403);
        console.warn(`[push-dispatch] canvas key rejected user=${userId} (${message})`);
        result.reason = "canvas-key-rejected";
        result.canvas = { host: userDomain, answer: message.slice(0, 160) };
        return result;
      }
      if (/Canvas [345]\d\d/.test(message)) {
        // Transient/permission problem — never blame the key.
        console.warn(`[push-dispatch] canvas request failed user=${userId} (${message})`);
        result.reason = `canvas-${message.match(/Canvas (\d{3})/)?.[1] ?? "error"}`;
        result.canvas = { host: userDomain, answer: message.slice(0, 160) };
        return result;
      }
      throw err;
    }
    await clearCanvasKeyStatus(admin, userId);

    // Queue tonight's deadline reminders (they need Canvas data); the 5-minute
    // scheduled run sends each one at its moment.
    if (!iphoneOnly) {
      await enqueueCountdowns(admin, userId, { ...prefs, countdownClass: false }, tz, tonight);
    } else {
      alerts = alerts.filter((a) => nativeAlertAllowed(a.id));
    }
    result.due = alerts.length;
    if (alerts.length === 0) {
      result.reason = "nothing-due";
      return result;
    }

    const delivered = await deliverToUser(admin, userId, userSubs, alerts, vapid, iphone);
    result.fresh = delivered.fresh;
    result.sent = delivered.sent;
    result.failures = delivered.failures;
    // Alerts were due but no device took any of them (e.g. broken push keys).
    result.reason =
      delivered.fresh === 0
        ? "already-sent"
        : delivered.sent === 0
          ? "delivery-failed"
          : "delivered";
  } catch (err) {
    result.failures += 1;
    result.reason = "error";
    console.error("[push-dispatch]", userId, err instanceof Error ? err.message : err);
  } finally {
    await recordHeartbeat(admin, userId, result.reason, previousHeartbeat);
  }
  return result;
}

/**
 * Checks every account with a registered device, or just `onlyUserId`.
 * Accounts are checked a few at a time rather than one after another, so a
 * slow Canvas school can't run the cron request out of time before later
 * accounts are reached.
 */
/**
 * Accounts with the iPhone app registered. Empty when the table isn't there
 * yet or can't be read, so web push carries on exactly as before.
 */
async function iphoneUserIds(admin: Admin, onlyUserId?: string): Promise<Set<string>> {
  try {
    let query = streakDb(admin).from("native_push_tokens").select("user_id");
    if (onlyUserId) query = query.eq("user_id", onlyUserId);
    const { data, error } = await query;
    if (error) return new Set();
    return new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
  } catch {
    return new Set();
  }
}

/** The cron secret, for the apns function's check. Empty if it can't be read. */
async function iphoneCronSecret(admin: Admin): Promise<string> {
  const { data } = await admin.from("push_cron_config").select("secret").limit(1).maybeSingle();
  return ((data?.secret ?? "") as string) || "";
}

async function run(onlyUserId?: string): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Global fallback only — each user's own Canvas URL takes priority, so
  // students from any school can receive alerts.
  const defaultDomain = normalizeCanvasDomain(process.env["CANVAS_DOMAIN"]);
  const { vapid } = await import("@/lib/vapid.server");
  if (!vapid.publicKey || !vapid.privateKey) {
    return Response.json({ error: "push not configured" }, { status: 500 });
  }
  const keys: Vapid = {
    publicKey: vapid.publicKey,
    privateKey: vapid.privateKey,
    subject: vapid.subject,
  };

  let query = supabaseAdmin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,failure_count");
  if (onlyUserId) query = query.eq("user_id", onlyUserId);
  const { data: subs, error } = await query;
  if (error) {
    console.error("[push-dispatch] subscription lookup failed", error.message);
    return Response.json({ error: "subscription lookup failed" }, { status: 500 });
  }
  const rows = (subs ?? []) as SubRow[];
  // The apns function checks the same secret the cron sends.
  const cronSecret = await iphoneCronSecret(supabaseAdmin);
  const iphoneUsers = cronSecret
    ? await iphoneUserIds(supabaseAdmin, onlyUserId)
    : new Set<string>();
  if (rows.length === 0 && iphoneUsers.size === 0) return Response.json({ users: 0, sent: 0 });

  const byUser = new Map<string, SubRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }
  // Students who only use the iPhone app have no browser subscriptions.
  for (const id of iphoneUsers) if (!byUser.has(id)) byUser.set(id, []);

  const users = Array.from(byUser);
  if (!onlyUserId) {
    // One request for everyone can be cut off before it finishes, so the accounts
    // that waited longest go first and every run reaches different students.
    const { data: checks } = await supabaseAdmin
      .from("user_preferences")
      .select("user_id,value")
      .eq("key", PUSH_HEARTBEAT_PREF)
      .in("user_id", Array.from(byUser.keys()));
    const lastCheck = new Map(
      (checks ?? []).map((row) => [
        row.user_id as string,
        lastServerCheck({ [PUSH_HEARTBEAT_PREF]: row.value }) ?? 0,
      ]),
    );
    users.sort(([a], [b]) => (lastCheck.get(a) ?? 0) - (lastCheck.get(b) ?? 0));
  }
  let sent = 0;
  let failures = 0;
  // Where each account's check stopped (counts only), visible in net._http_response.
  const accounts: Array<Omit<DispatchResult, "failures">> = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(USER_CONCURRENCY, users.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= users.length) return;
        const [userId, userSubs] = users[i]!;
        const r = await dispatchUser(
          supabaseAdmin,
          userId,
          userSubs,
          keys,
          defaultDomain,
          iphoneUsers.has(userId) ? { cronSecret } : null,
        );
        sent += r.sent;
        failures += r.failures;
        accounts.push({
          reason: r.reason,
          stats: r.stats,
          due: r.due,
          fresh: r.fresh,
          sent: r.sent,
          canvas: r.canvas,
        });
      }
    }),
  );

  console.info(`[push-dispatch] done users=${byUser.size} sent=${sent} failures=${failures}`);
  return Response.json({ users: byUser.size, sent, failures, accounts });
}

/**
 * Sends queued countdowns (a class starting soon, tonight's deadlines) whose
 * moment has arrived. Runs every 5 minutes and never calls Canvas, so a
 * "starts in 15 min" reminder lands 15 minutes before class. A reminder a
 * missed run left behind still goes out while it is useful. Every reminder it
 * handles (sent, or dropped as too late) gets `sent_at`, so the health check
 * only flags ones nothing handled.
 */
async function runScheduled(): Promise<Response> {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { vapid } = await import("@/lib/vapid.server");
  if (!vapid.publicKey || !vapid.privateKey) {
    return Response.json({ error: "push not configured" }, { status: 500 });
  }
  const keys: Vapid = {
    publicKey: vapid.publicKey,
    privateKey: vapid.privateKey,
    subject: vapid.subject,
  };

  const now = Date.now();
  const { data: rows, error } = await admin
    .from("push_scheduled_alerts")
    .select("user_id,tag,fire_at,title,body,to_path,badge")
    .is("sent_at", null)
    .lte("fire_at", new Date(now).toISOString())
    .gt("fire_at", new Date(now - SCHEDULED_LOOKBACK_MS).toISOString());
  if (error) {
    console.error("[push-scheduled] lookup failed", error.message);
    return Response.json({ error: "scheduled lookup failed" }, { status: 500 });
  }

  const byUser = new Map<string, NonNullable<typeof rows>>();
  for (const row of rows ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }
  if (byUser.size === 0) return Response.json({ users: 0, sent: 0 });

  const userIds = Array.from(byUser.keys());
  const [{ data: subs }, { data: prefRows }] = await Promise.all([
    admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth,failure_count")
      .in("user_id", userIds),
    admin
      .from("notification_prefs")
      .select("user_id,prefs,timezone_offset_minutes")
      .in("user_id", userIds),
  ]);

  const streakUsers = Array.from(byUser)
    .filter(([, queued]) => queued.some((r) => r.tag.startsWith("streak:")))
    .map(([userId]) => userId);
  const activeOn = await streakActiveDays(admin, streakUsers);

  const markHandled = async (userId: string, tags: string[]) => {
    if (tags.length === 0) return;
    const { error: markError } = await admin
      .from("push_scheduled_alerts")
      .update({ sent_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("tag", tags)
      .is("sent_at", null);
    if (markError) console.error("[push-scheduled] mark failed", userId, markError.message);
  };

  let sent = 0;
  let failures = 0;
  for (const [userId, queued] of byUser) {
    // Too late to be useful, or replaced by a later step: never sent.
    const planned = planScheduledAlerts(queued, new Date(now), SCHEDULED_GRACE_MS);
    const drop = [...planned.drop];
    const list = planned.send.filter((r) => {
      if (!r.tag.startsWith("streak:")) return true;
      // Couldn't read streaks: leave it for the next run.
      if (activeOn === null) return false;
      // Opened CoursePro that day after it was queued: the streak is safe.
      const last = activeOn.get(userId);
      if (last && last >= r.tag.split(":")[1]!) {
        drop.push(r);
        return false;
      }
      return true;
    });
    await markHandled(
      userId,
      drop.map((r) => r.tag),
    );
    const userSubs = ((subs ?? []) as SubRow[]).filter((s) => s.user_id === userId);
    if (userSubs.length === 0) continue;
    const prefRow = (prefRows ?? []).find((p) => p.user_id === userId);
    // Settings as they are now, not when the reminder was queued.
    const prefs: ServerPrefs = {
      ...SERVER_DEFAULT_PREFS,
      ...((prefRow?.prefs ?? {}) as Partial<ServerPrefs>),
    };
    if (!prefs.enabled || !prefs.browserPush) continue;
    if (isQuiet(prefs, prefRow?.timezone_offset_minutes ?? 0)) continue;
    const alerts: Alert[] = list
      .filter((r) => scheduledAlertAllowed(r.tag, prefs))
      .map((r) => ({
        id: r.tag,
        title: r.title,
        body: r.body || undefined,
        to: r.to_path || "/dashboard",
        badge: prefs.badge ? (r.badge ?? null) : null,
      }));
    try {
      const result = await deliverToUser(admin, userId, userSubs, alerts, keys);
      sent += result.sent;
      failures += result.failures;
      // Not delivered stays unhandled, so the next run tries again.
      await markHandled(userId, result.logged);
    } catch (err) {
      failures += 1;
      console.error("[push-scheduled]", userId, err instanceof Error ? err.message : err);
    }
  }

  console.info(`[push-scheduled] users=${byUser.size} sent=${sent} failures=${failures}`);
  return Response.json({ users: byUser.size, sent, failures });
}

/** Sends a test only to the requested endpoint owned by the signed-in user. */
async function runTest(accessToken: string, endpoint: string): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData } = await supabaseAdmin.auth.getUser(accessToken);
  const user = userData?.user;
  if (!user) {
    return Response.json({ ok: false, message: "You need to be signed in." }, { status: 401 });
  }
  if (!endpoint || !isPushServiceEndpoint(endpoint)) {
    return Response.json(
      { ok: false, message: "Choose this device's push registration first." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) {
    console.error("[push-test] subscription lookup failed", error.message);
    return Response.json({ ok: false, message: "Couldn't read your devices." });
  }
  const subs = (data ?? []) as Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>;
  if (subs.length === 0) {
    return Response.json({
      ok: false,
      message: "No device registered yet — turn on “Alerts when CoursePro is closed” first.",
    });
  }

  const { sendWebPushWithRetry } = await import("@/lib/webpush.server");
  const { vapid } = await import("@/lib/vapid.server");
  let delivered = 0;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      const res = await sendWebPushWithRetry(
        s,
        {
          title: "CoursePro test notification",
          body: "Push delivery is working on this device.",
          to: "/settings",
          tag: `test:${Date.now()}`,
        },
        {
          ...vapid,
          ttl: 60,
          context: `test user=${user.id}`,
        },
      );
      if (res.ok) delivered += 1;
      else if (res.expired) dead.push(s.id);
    }),
  );
  if (dead.length > 0) {
    console.warn(`[push-test] removing ${dead.length} expired subscription(s) user=${user.id}`);
    await supabaseAdmin.from("push_subscriptions").delete().in("id", dead);
  }

  console.info(`[push-test] user=${user.id} devices=${subs.length} delivered=${delivered}`);
  return Response.json({
    ok: delivered > 0,
    delivered,
    devices: subs.length,
    message:
      delivered > 0
        ? `Test notification sent to ${delivered} device${delivered === 1 ? "" : "s"}.`
        : dead.length > 0
          ? "This device's registration was out of date and has been cleared — turn “Alerts when CoursePro is closed” off and on, then test again."
          : "Push delivery failed on every registered device — try turning background alerts off and on.",
  });
}

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let action = "";
        let userId = "";
        let endpoint = "";
        try {
          const body = (await request.json()) as {
            action?: string;
            user_id?: string;
            endpoint?: string;
          } | null;
          action = String(body?.action ?? "");
          userId = String(body?.user_id ?? "");
          endpoint = String(body?.endpoint ?? "");
        } catch {
          action = "";
        }

        if (action === "test") {
          const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
          if (!token) {
            return Response.json(
              { ok: false, message: "You need to be signed in." },
              { status: 401 },
            );
          }
          try {
            return await runTest(token, endpoint);
          } catch (err) {
            console.error("[push-test] failed", err);
            return Response.json(
              { ok: false, message: "Couldn't send the test notification." },
              { status: 500 },
            );
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const provided = request.headers.get("x-cron-secret") ?? "";
        const { data } = await supabaseAdmin
          .from("push_cron_config")
          .select("secret")
          .limit(1)
          .maybeSingle();
        const expected = (data?.secret ?? "") as string;
        if (!expected || !constantTimeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (action === "scheduled") return runScheduled();
        if (userId && !USER_ID.test(userId)) {
          return Response.json({ error: "invalid user_id" }, { status: 400 });
        }
        return run(userId || undefined);
      },
    },
  },
});
