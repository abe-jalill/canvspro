import { createFileRoute } from "@tanstack/react-router";
import {
  buildAlertsForUser,
  deliver,
  isQuiet,
  SERVER_DEFAULT_PREFS,
  type ServerPrefs,
} from "@/lib/push-dispatch.server";

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function run(): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const domain = process.env["CANVAS_DOMAIN"];
  const vapid = {
    publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "",
    privateKey: process.env["VAPID_PRIVATE_KEY"] ?? "",
    subject: process.env["VAPID_SUBJECT"] ?? "mailto:support@canvaspro.app",
  };
  if (!domain || !vapid.publicKey || !vapid.privateKey) {
    return Response.json({ error: "push not configured" }, { status: 500 });
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth");
  const rows = (subs ?? []) as SubRow[];
  if (rows.length === 0) return Response.json({ users: 0, sent: 0 });

  const byUser = new Map<string, SubRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  let sent = 0;
  for (const [userId, userSubs] of byUser) {
    try {
      const [{ data: prefRow }, { data: settings }] = await Promise.all([
        supabaseAdmin
          .from("notification_prefs")
          .select("prefs,timezone_offset_minutes")
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("user_settings")
          .select("canvas_api_key")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const token = (settings?.canvas_api_key ?? "").trim();
      if (!token) continue;

      const prefs: ServerPrefs = {
        ...SERVER_DEFAULT_PREFS,
        ...((prefRow?.prefs ?? {}) as Partial<ServerPrefs>),
      };
      if (!prefs.enabled || !prefs.browserPush) continue;
      if (isQuiet(prefs, prefRow?.timezone_offset_minutes ?? 0)) continue;

      const alerts = await buildAlertsForUser(domain, token, prefs);
      if (alerts.length === 0) continue;

      const { data: sentRows } = await supabaseAdmin
        .from("push_sent_log")
        .select("alert_id")
        .eq("user_id", userId)
        .in(
          "alert_id",
          alerts.map((a) => a.id),
        );
      const already = new Set((sentRows ?? []).map((r) => r.alert_id as string));
      const fresh = alerts.filter((a) => !already.has(a.id)).slice(0, 12);
      if (fresh.length === 0) continue;

      const dead = new Set<string>();
      for (const alert of fresh) {
        const targets = userSubs.filter((s) => !dead.has(s.id));
        if (targets.length === 0) break;
        const expired = await deliver(targets, alert, vapid);
        expired.forEach((id) => dead.add(id));
        sent += 1;
      }

      await supabaseAdmin
        .from("push_sent_log")
        .upsert(fresh.map((a) => ({ user_id: userId, alert_id: a.id })));
      if (dead.size > 0) {
        await supabaseAdmin.from("push_subscriptions").delete().in("id", Array.from(dead));
      }
    } catch (err) {
      console.error("[push-dispatch]", userId, err instanceof Error ? err.message : err);
    }
  }

  return Response.json({ users: byUser.size, sent });
}

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const provided = request.headers.get("x-cron-secret") ?? "";
        const { data } = await supabaseAdmin
          .from("push_cron_config")
          .select("secret")
          .limit(1)
          .maybeSingle();
        const expected = data?.secret ?? "";
        if (!expected || provided.length !== expected.length || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        return run();
      },
    },
  },
});
