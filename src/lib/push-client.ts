import { supabase } from "@/integrations/supabase/client";
import { readPrefs } from "@/lib/notification-prefs";

/**
 * The application-server public key comes from the server itself, so the key a
 * device subscribes with is always the key the sender signs with. A hardcoded
 * copy is what previously caused "push delivery failed on every device" (the
 * push service rejects a mismatched VAPID identity with 403).
 */
async function fetchServerPublicKey(): Promise<string> {
  const res = await fetch("/api/public/push/key", { cache: "no-store" });
  if (!res.ok) throw new Error("Push isn't configured on the server yet.");
  const body = (await res.json()) as { publicKey?: string };
  const key = (body.publicKey ?? "").trim();
  if (!key) throw new Error("Push isn't configured on the server yet.");
  return key;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** True inside the Lovable editor preview iframe, where service workers can't register. */
export function inEditorPreview(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    window.self !== window.top ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host.endsWith(".lovableproject.com")
  );
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}


/** True on iOS/iPadOS Safari outside an installed home-screen app. */
export function needsHomeScreenInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return !standalone && !("PushManager" in window);
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Mirrors the local notification preferences to the backend for the cron job. */
export async function syncPrefsToServer(): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;
  await supabase.from("notification_prefs").upsert(
    {
      user_id: user.id,
      prefs: JSON.parse(JSON.stringify(readPrefs())),
      timezone_offset_minutes: new Date().getTimezoneOffset(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  return Boolean(sub);
}

export async function enableBackgroundPush(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (inEditorPreview()) {
    return {
      ok: false,
      reason:
        "Background alerts can only be turned on from the live site (canvaspro.app), not the editor preview.",
    };
  }
  if (!pushSupported()) {
    return {
      ok: false,
      reason: needsHomeScreenInstall()
        ? "On iPhone/iPad, add CanvasPro to your Home Screen first, then turn this on from the installed app."
        : "This browser doesn't support background notifications.",
    };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Notification permission was denied." };

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  // Drop any stale subscription first: one made with a different VAPID key can
  // never be delivered to, and the browser refuses to re-subscribe over it.
  const stale = await reg.pushManager.getSubscription();
  if (stale) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", stale.endpoint);
    await stale.unsubscribe().catch(() => undefined);
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  });

  const json = sub.toJSON();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, reason: "You need to be signed in." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, reason: error.message };

  await syncPrefsToServer();
  return { ok: true };
}

export async function disableBackgroundPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
