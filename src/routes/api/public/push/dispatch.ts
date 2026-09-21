import { createFileRoute } from "@tanstack/react-router";
import {
  buildAlertsForUser,
  deliver,
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
 * Queues the user's upcoming countdown pushes (next class, tonight's deadlines)
 * and returns the ones whose moment has arrived. `push_sent_log` handles dedupe,
 * so queued rows are safe to re-read until they age out.
 */
async function enqueueCountdowns(
  admin: Admin,
  userId: string,
  prefs: ServerPrefs,
  tz: number,
  tonight: TonightItem[],
): Promise<Alert[]> {
  if (!prefs.countdownClass && !prefs.countdownTonight) return [];
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
    await admin
      .from("push_scheduled_alerts")
      .upsert(
        rows.map((r) => ({ ...r, user_id: userId })),
        { onConflict: "user_id,tag", ignoreDuplicates: true },
      );
  }

  // Anything scheduled for the past 6 hours is still worth delivering; older
  // rows are pruned so the table stays small.
  const cutoff = new Date(now.getTime() - 6 * 3_600_000).toISOString();
  await admin
    .from("push_scheduled_alerts")
    .delete()
    .eq("user_id", userId)
    .lt("fire_at", new Date(now.getTime() - 3 * 86_400_000).toISOString());

  const { data: pending } = await admin
    .from("push_scheduled_alerts")
    .select("tag,title,body,to_path,badge,fire_at")
    .eq("user_id", userId)
    .lte("fire_at", now.toISOString())
    .gte("fire_at", cutoff)
    .order("fire_at", { ascending: false });

  return (pending ?? []).map((r) => ({
    id: r.tag as string,
    title: r.title as string,
    body: (r.body as string) || undefined,
    to: (r.to_path as string) || "/dashboard",
    badge: prefs.badge ? ((r.badge as number | null) ?? null) : null,
  }));
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

async function run(): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Global fallback only — each user's own Canvas URL takes priority, so
  // students from any school can receive alerts.
  const defaultDomain = normalizeCanvasDomain(process.env["CANVAS_DOMAIN"]);
  const { vapid } = await import("@/lib/vapid.server");
  if (!vapid.publicKey || !vapid.privateKey) {
    return Response.json({ error: "push not configured" }, { status: 500 });
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,failure_count");
  const rows = (subs ?? []) as SubRow[];
  if (rows.length === 0) return Response.json({ users: 0, sent: 0 });

  const byUser = new Map<string, SubRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  let sent = 0;
  let failures = 0;
  for (const [userId, userSubs] of byUser) {
    try {
      const [{ data: prefRow }, { data: settings }, { data: hiddenRow }] = await Promise.all([
        supabaseAdmin
          .from("notification_prefs")
          .select("prefs,timezone_offset_minutes")
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("user_settings")
          .select("canvas_api_key,canvas_domain")
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("user_preferences")
          .select("value")
          .eq("user_id", userId)
          .eq("key", "hidden_course_ids")
          .maybeSingle(),
      ]);

      const hiddenIds = new Set<number>(
        Array.isArray(hiddenRow?.value)
          ? (hiddenRow.value as unknown[])
              .map((v) => Number(v))
              .filter((n) => Number.isFinite(n))
          : [],
      );

      const token = (settings?.canvas_api_key ?? "").trim();
      if (!token) continue;
      // The student's own school URL, falling back to the global default for
      // accounts saved before per-school URLs existed.
      const userDomain = normalizeCanvasDomain(settings?.canvas_domain) || defaultDomain;
      if (!userDomain) continue;

      const prefs: ServerPrefs = {
        ...SERVER_DEFAULT_PREFS,
        ...((prefRow?.prefs ?? {}) as Partial<ServerPrefs>),
      };
      if (!prefs.enabled || !prefs.browserPush) continue;
      const tz = prefRow?.timezone_offset_minutes ?? 0;
      if (isQuiet(prefs, tz)) continue;

      let alerts: Alert[];
      let tonight: TonightItem[];
      try {
        const built = await buildAlertsForUser(userDomain, token, prefs, tz, hiddenIds);
        alerts = built.alerts;
        tonight = built.tonight;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Canvas rejecting the stored token is a user-fixable problem, not a
        // server fault: flag it so the app can ask for a fresh key instead of
        // failing silently every 15 minutes.
        // Canvas uses 403 both for a bad token AND for throttling
        // ("Rate Limit Exceeded"), and 403 also appears for courses the
        // student simply can't read. Only a real authentication rejection
        // should ask the user for a new key.
        const authRejected =
          /Canvas 401/.test(message) ||
          (/Canvas 403/.test(message) &&
            /invalid access token|unauthorized|insufficient scopes|revoked|expired/i.test(message));
        if (authRejected) {
          await setCanvasKeyStatus(supabaseAdmin, userId, message.includes("401") ? 401 : 403);
          console.warn(`[push-dispatch] canvas key rejected user=${userId} (${message})`);
          continue;
        }
        if (/Canvas 4\d\d|Canvas 5\d\d/.test(message)) {
          // Transient/permission problem — never blame the key.
          console.warn(`[push-dispatch] canvas request failed user=${userId} (${message})`);
          continue;
        }
        throw err;
      }
      await clearCanvasKeyStatus(supabaseAdmin, userId);

      // Queue exact-time countdown pushes for the next few hours, then collect
      // any queued row whose moment has arrived.
      const countdowns = await enqueueCountdowns(supabaseAdmin, userId, prefs, tz, tonight);
      const due = [...countdowns, ...alerts];
      if (due.length === 0) continue;

      const { data: sentRows } = await supabaseAdmin
        .from("push_sent_log")
        .select("alert_id")
        .eq("user_id", userId)
        .in(
          "alert_id",
          due.map((a) => a.id),
        );
      const already = new Set((sentRows ?? []).map((r) => r.alert_id as string));
      const fresh = due.filter((a) => !already.has(a.id)).slice(0, 12);
      if (fresh.length === 0) continue;

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
          sent += 1;
        } else {
          failures += 1;
          console.error(
            `[push-dispatch] alert not delivered user=${userId} alert=${alert.id} targets=${targets.length}`,
          );
        }
      }

      // Only mark alerts as sent when at least one device actually got them,
      // so a transient outage doesn't permanently suppress the notification.
      if (loggable.length > 0) {
        await supabaseAdmin
          .from("push_sent_log")
          .upsert(loggable.map((a) => ({ user_id: userId, alert_id: a.id })));
      }
      if (dead.size > 0) {
        console.warn(
          `[push-dispatch] removing ${dead.size} expired subscription(s) user=${userId}`,
        );
        await supabaseAdmin.from("push_subscriptions").delete().in("id", Array.from(dead));
      }
      if (okSubs.size > 0) {
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ failure_count: 0, last_success_at: new Date().toISOString() })
          .in("id", Array.from(okSubs));
      }
      for (const id of failedSubs) {
        if (okSubs.has(id)) continue;
        const row = userSubs.find((s) => s.id === id);
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ failure_count: (row?.failure_count ?? 0) + 1 })
          .eq("id", id);
      }
    } catch (err) {
      failures += 1;
      console.error("[push-dispatch]", userId, err instanceof Error ? err.message : err);
    }
  }

  console.info(`[push-dispatch] done users=${byUser.size} sent=${sent} failures=${failures}`);
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
  const subs = (data ?? []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
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
        try {
          const body = (await request.json()) as { action?: string } | null;
          action = String(body?.action ?? "");
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
        return run();
      },
    },
  },
});
