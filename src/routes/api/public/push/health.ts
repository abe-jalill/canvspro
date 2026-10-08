import { createFileRoute } from "@tanstack/react-router";
import { PUSH_HEARTBEAT_PREF } from "@/lib/push-heartbeat";
import {
  inDispatchWindow,
  pushHealthProblems,
  readAccountCheck,
  type AccountCheck,
} from "@/lib/push-health";
import {
  isPushServiceEndpoint,
  isQuiet,
  scheduledAlertAllowed,
  SERVER_DEFAULT_PREFS,
  type ServerPrefs,
} from "@/lib/push-dispatch.server";

/** A queued reminder this late should already have gone out (the sender runs every 5 minutes). */
const OVERDUE_AFTER_MS = 10 * 60_000;
const LOOKBACK_MS = 3 * 60 * 60_000;

/**
 * Whether closed-app notifications are working, as problem codes (see
 * push-health.ts). Answers with codes only: no accounts, ids or counts.
 */
async function check(): Promise<string[]> {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const now = Date.now();
  const [subsRes, beatsRes, rowsRes] = await Promise.all([
    admin.from("push_subscriptions").select("user_id,endpoint"),
    admin.from("user_preferences").select("user_id,value").eq("key", PUSH_HEARTBEAT_PREF),
    admin
      .from("push_scheduled_alerts")
      .select("user_id,tag,fire_at")
      .lte("fire_at", new Date(now - OVERDUE_AFTER_MS).toISOString())
      .gte("fire_at", new Date(now - LOOKBACK_MS).toISOString()),
  ]);
  if (subsRes.error || beatsRes.error || rowsRes.error) throw new Error("health lookup failed");

  // Only accounts that still have a device are checked by the background job.
  const subs = subsRes.data ?? [];
  const subscribed = new Set(subs.map((s) => s.user_id));
  const reachable = new Set(
    subs.filter((s) => isPushServiceEndpoint(s.endpoint)).map((s) => s.user_id),
  );
  const checks = (beatsRes.data ?? [])
    .filter((b) => subscribed.has(b.user_id))
    .map((b) => readAccountCheck(b.value))
    .filter((c): c is AccountCheck => c !== null);

  // Reminders that came due while the 5-minute sender runs, for accounts with a working device.
  const candidates = (rowsRes.data ?? []).filter(
    (r) => reachable.has(r.user_id) && inDispatchWindow(new Date(r.fire_at).getUTCHours()),
  );
  let overdue = 0;
  if (candidates.length > 0) {
    const users = Array.from(new Set(candidates.map((r) => r.user_id)));
    const [{ data: prefRows }, { data: sent }] = await Promise.all([
      admin
        .from("notification_prefs")
        .select("user_id,prefs,timezone_offset_minutes")
        .in("user_id", users),
      admin
        .from("push_sent_log")
        .select("user_id,alert_id")
        .in("user_id", users)
        .in(
          "alert_id",
          candidates.map((r) => r.tag),
        ),
    ]);
    const sentKeys = new Set((sent ?? []).map((s) => `${s.user_id}|${s.alert_id}`));
    for (const r of candidates) {
      if (sentKeys.has(`${r.user_id}|${r.tag}`)) continue;
      const row = (prefRows ?? []).find((p) => p.user_id === r.user_id);
      // The same rules the sender applies, judged at the reminder's own time.
      const prefs: ServerPrefs = {
        ...SERVER_DEFAULT_PREFS,
        ...((row?.prefs ?? {}) as Partial<ServerPrefs>),
      };
      if (!prefs.enabled || !prefs.browserPush) continue;
      if (isQuiet(prefs, row?.timezone_offset_minutes ?? 0, new Date(r.fire_at))) continue;
      if (!scheduledAlertAllowed(r.tag, prefs)) continue;
      overdue += 1;
    }
  }

  return pushHealthProblems({ now, checks, overdueReminders: overdue });
}

export const Route = createFileRoute("/api/public/push/health")({
  server: {
    handlers: {
      GET: async () => {
        const headers = { "cache-control": "no-store" };
        try {
          const problems = await check();
          return Response.json({ ok: problems.length === 0, problems }, { headers });
        } catch (err) {
          console.error("[push-health]", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, problems: ["health-check-error"] },
            { status: 500, headers },
          );
        }
      },
    },
  },
});
