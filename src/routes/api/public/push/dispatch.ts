import { createFileRoute } from "@tanstack/react-router";
import { completedAssignmentIds } from "@/lib/completion-records";
import { PUSH_HEARTBEAT_PREF, lastServerCheck } from "@/lib/push-heartbeat";
import {
  buildAlertsForUser,
  deliver,
  type BuildStats,
  isQuiet,
  normalizeCanvasDomain,
  SERVER_DEFAULT_PREFS,
  type Alert,
  type ServerPrefs,
} from "@/lib/push-dispatch.server";
import {
  buildClassCountdownAlerts,
  buildTonightAlerts,
  type ScheduledAlertRow,
  type ScheduleRow,
  type TonightItem,
} from "@/lib/countdown-alerts.server";

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

/**
 * How late a queued countdown may still go out. The scheduled run fires every
 * 5 minutes; anything later than this would show the wrong countdown
 * ("starts in 15 min" when class is already starting), so it is dropped.
 */
const SCHEDULED_GRACE_MS = 6 * 60_000;

/**
 * Sends the alerts this account hasn't had yet to its devices, records what
 * went out, and tidies up dead or failing subscriptions.
 */
async function deliverToUser(
  admin: Admin,
  userId: string,
  userSubs: SubRow[],
  due: Alert[],
  vapid: Vapid,
): Promise<{ sent: number; failures: number; fresh: number }> {
  const out = { sent: 0, failures: 0, fresh: 0 };
  if (due.length === 0) return out;
  const { data: sentRows } = await admin
    .from("push_sent_log")
    .select("alert_id")
    .eq("user_id", userId)
    .in(
      "alert_id",
      due.map((a) => a.id),
    );
  const already = new Set((sentRows ?? []).map((r) => r.alert_id as string));
  const fresh = due.filter((a) => !already.has(a.id)).slice(0, 12);
  out.fresh = fresh.length;
  if (fresh.length === 0) return out;

  const dead = new Set<string>();
  const failedSubs = new Set<string>();
  const okSubs = new Set<string>();
  const loggable: typeof fresh = [];
  for (const alert of fresh) {
    const targets = userSubs.filter((s) => !dead.has(s.id));
    if (targets.length === 0) break;
    const report = await deliver(targets, alert, vapid);
    report.dead.forEach((id) => dead.add(id));
    report.failed.forEach((id) => failedSubs.add(id));
    report.delivered.forEach((id) => okSubs.add(id));
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

/** Records that the background check looked at this account just now. */
async function recordHeartbeat(admin: Admin, userId: string): Promise<void> {
  const { error } = await admin
    .from("user_preferences")
    .upsert(
      { user_id: userId, key: PUSH_HEARTBEAT_PREF, value: { checkedAt: new Date().toISOString() } },
      { onConflict: "user_id,key" },
    );
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
): Promise<DispatchResult> {
  const result: DispatchResult = { sent: 0, failures: 0, reason: "error" };
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

    const prefs: ServerPrefs = {
      ...SERVER_DEFAULT_PREFS,
      ...((prefRow?.prefs ?? {}) as Partial<ServerPrefs>),
    };
    if (!prefs.enabled || !prefs.browserPush) {
      result.reason = "alerts-off";
      return result;
    }
    const tz = prefRow?.timezone_offset_minutes ?? 0;
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
      if (/Canvas 4\d\d|Canvas 5\d\d/.test(message)) {
        // Transient/permission problem — never blame the key.
        console.warn(`[push-dispatch] canvas request failed user=${userId} (${message})`);
        result.reason = `canvas-${message.match(/Canvas (\d{3})/)?.[1] ?? "error"}`;
        result.canvas = { host: userDomain, answer: message.slice(0, 160) };
        return result;
      }
      throw err;
    }
    await clearCanvasKeyStatus(admin, userId);

    // Queue exact-time countdown pushes for the next few hours; the 5-minute
    // scheduled run sends each one at its moment.
    await enqueueCountdowns(admin, userId, prefs, tz, tonight);
    result.due = alerts.length;
    if (alerts.length === 0) {
      result.reason = "nothing-due";
      return result;
    }

    const delivered = await deliverToUser(admin, userId, userSubs, alerts, vapid);
    result.fresh = delivered.fresh;
    result.sent = delivered.sent;
    result.failures = delivered.failures;
    result.reason = delivered.fresh === 0 ? "already-sent" : "delivered";
  } catch (err) {
    result.failures += 1;
    result.reason = "error";
    console.error("[push-dispatch]", userId, err instanceof Error ? err.message : err);
  } finally {
    await recordHeartbeat(admin, userId);
  }
  return result;
}

/**
 * Checks every account with a registered device, or just `onlyUserId`.
 * Accounts are checked a few at a time rather than one after another, so a
 * slow Canvas school can't run the cron request out of time before later
 * accounts are reached.
 */
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
  if (rows.length === 0) return Response.json({ users: 0, sent: 0 });

  const byUser = new Map<string, SubRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

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
        const r = await dispatchUser(supabaseAdmin, userId, userSubs, keys, defaultDomain);
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
 * moment has just arrived. Runs every 5 minutes and never calls Canvas, so a
 * "starts in 15 min" reminder lands 15 minutes before class.
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
    .select("user_id,tag,title,body,to_path,badge")
    .lte("fire_at", new Date(now).toISOString())
    .gt("fire_at", new Date(now - SCHEDULED_GRACE_MS).toISOString());
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

  let sent = 0;
  let failures = 0;
  for (const [userId, list] of byUser) {
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
      .filter((r) =>
        r.tag.startsWith("class:")
          ? prefs.countdownClass && prefs.countdownLeads.includes(Number(r.tag.split(":").pop()))
          : prefs.countdownTonight,
      )
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
    } catch (err) {
      failures += 1;
      console.error("[push-scheduled]", userId, err instanceof Error ? err.message : err);
    }
  }

  console.info(`[push-scheduled] users=${byUser.size} sent=${sent} failures=${failures}`);
  return Response.json({ users: byUser.size, sent, failures });
}

/** Sends a "test notification" push to every device the signed-in user registered. */
async function runTest(accessToken: string): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData } = await supabaseAdmin.auth.getUser(accessToken);
  const user = userData?.user;
  if (!user) {
    return Response.json({ ok: false, message: "You need to be signed in." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", user.id);
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
      message: "No device registered yet — turn on “Alerts when CanvasPro is closed” first.",
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
          title: "CanvasPro test notification",
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
          ? "This device's registration was out of date and has been cleared — turn “Alerts when CanvasPro is closed” off and on, then test again."
          : "Push delivery failed on every registered device — try turning background alerts off and on.",
  });
}

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let action = "";
        let userId = "";
        try {
          const body = (await request.json()) as { action?: string; user_id?: string } | null;
          action = String(body?.action ?? "");
          userId = String(body?.user_id ?? "");
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
            return await runTest(token);
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
