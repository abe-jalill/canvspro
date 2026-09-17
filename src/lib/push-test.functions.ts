import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/lib/vapid";

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface TestPushResult {
  ok: boolean;
  delivered: number;
  devices: number;
  message: string;
}

/** Sends a "test notification" push to every device the signed-in user registered. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TestPushResult> => {
    const { userId, supabase } = context;
    const vapid = {
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY,
      subject: VAPID_SUBJECT,
    };
    if (!vapid.publicKey || !vapid.privateKey) {
      console.error("[push-test] VAPID keys are not configured");
      return {
        ok: false,
        delivered: 0,
        devices: 0,
        message: "Push isn't configured on the server.",
      };
    }

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", userId);
    if (error) {
      console.error("[push-test] subscription lookup failed", error.message);
      return { ok: false, delivered: 0, devices: 0, message: "Couldn't read your devices." };
    }
    const subs = (data ?? []) as SubRow[];
    if (subs.length === 0) {
      return {
        ok: false,
        delivered: 0,
        devices: 0,
        message: "No device registered yet — turn on “Alerts when CanvasPro is closed” first.",
      };
    }

    const { sendWebPushWithRetry } = await import("@/lib/webpush.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
          { ...vapid, context: `test user=${userId}`, ttl: 60 },
        );
        if (res.ok) delivered += 1;
        else if (res.expired) dead.push(s.id);
      }),
    );

    if (dead.length > 0) {
      console.warn(`[push-test] removing ${dead.length} expired subscription(s) user=${userId}`);
      await supabaseAdmin.from("push_subscriptions").delete().in("id", dead);
    }

    console.info(`[push-test] user=${userId} devices=${subs.length} delivered=${delivered}`);
    return {
      ok: delivered > 0,
      delivered,
      devices: subs.length,
      message:
        delivered > 0
          ? `Test notification sent to ${delivered} device${delivered === 1 ? "" : "s"}.`
          : "Push delivery failed on every registered device — try turning background alerts off and on.",
    };
  });
