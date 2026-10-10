// Sends Apple push notifications to one account's iPhones.
//
// Why an edge function: Apple's push service only accepts HTTP/2. This runs on
// Deno, whose fetch speaks HTTP/2; the site's own server runs on Cloudflare
// Workers, where that isn't guaranteed (and a silent failure there is exactly
// how web push broke before). Called by the background check with the cron
// secret: POST { user_id, alerts: [{ id, title, body?, to, badge? }] }.
//
// Needs secrets APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (and optionally
// APNS_BUNDLE_ID), which require a paid Apple Developer account.

interface Alert {
  id: string;
  title: string;
  body?: string;
  to: string;
  badge?: number | null;
}
interface Token {
  id: string;
  token: string;
  environment: "sandbox" | "production";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    "Content-Type": "application/json",
  };
  if (!SERVICE_KEY.startsWith("sb_secret_")) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  return headers;
}

async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...adminHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
}

/** Compares two secrets without leaking per-character timing. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function base64url(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

let cachedJwt: { value: string; createdAt: number } | null = null;

/** The ES256 provider token Apple expects, reused for 45 minutes. */
async function providerToken(teamId: string, keyId: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.createdAt < 45 * 60) return cachedJwt.value;
  const input = `${base64url(JSON.stringify({ alg: "ES256", kid: keyId }))}.${base64url(
    JSON.stringify({ iss: teamId, iat: now }),
  )}`;
  const der = Uint8Array.from(
    atob(
      privateKey
        .replace(/\\n/g, "\n")
        .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""),
    ),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(input),
  );
  cachedJwt = { value: `${input}.${base64url(signature)}`, createdAt: now };
  return cachedJwt.value;
}

async function send(token: Token, alert: Alert, jwt: string, bundleId: string) {
  const body = JSON.stringify({
    aps: {
      alert: { title: alert.title, ...(alert.body ? { body: alert.body } : {}) },
      sound: "default",
      "thread-id": alert.id.split(":")[0],
      ...(alert.badge == null ? {} : { badge: alert.badge }),
    },
    to: alert.to,
  });
  const attempt = async (environment: Token["environment"]) => {
    const host = environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
    const response = await fetch(`https://${host}/3/device/${token.token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        // Same alert id replaces instead of stacking, like the web's notification tag.
        "apns-collapse-id": alert.id.slice(0, 64),
        "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600),
        "content-type": "application/json",
      },
      body,
    });
    const reason = response.ok
      ? undefined
      : ((await response.json().catch(() => ({}))) as { reason?: string }).reason;
    return { ok: response.ok, status: response.status, reason };
  };
  let result = await attempt(token.environment);
  // A development build and an App Store build use different gateways.
  if (!result.ok && result.reason === "BadDeviceToken") {
    result = await attempt(token.environment === "sandbox" ? "production" : "sandbox");
  }
  const dead =
    result.status === 410 || result.reason === "BadDeviceToken" || result.reason === "Unregistered";
  return { ...result, dead };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secretRes = await rest("push_cron_config?select=secret&limit=1");
  const expected = secretRes.ok
    ? (((await secretRes.json()) as Array<{ secret?: string }>)[0]?.secret ?? "")
    : "";
  if (!expected || !sameSecret(req.headers.get("x-cron-secret") ?? "", expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const teamId = Deno.env.get("APNS_TEAM_ID")?.trim() ?? "";
  const keyId = Deno.env.get("APNS_KEY_ID")?.trim() ?? "";
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY")?.trim() ?? "";
  const bundleId = Deno.env.get("APNS_BUNDLE_ID")?.trim() || "app.canvaspro.mobile";
  if (!teamId || !keyId || !privateKey) {
    return Response.json({ sent: 0, reason: "apns-not-configured" });
  }

  const input = (await req.json().catch(() => null)) as {
    user_id?: string;
    alerts?: Alert[];
  } | null;
  const userId = input?.user_id ?? "";
  const alerts = (input?.alerts ?? []).slice(0, 12);
  if (!/^[0-9a-f-]{36}$/i.test(userId) || alerts.length === 0) {
    return Response.json({ error: "user_id and alerts are required" }, { status: 400 });
  }

  const tokensRes = await rest(
    `native_push_tokens?select=id,token,environment&user_id=eq.${encodeURIComponent(userId)}`,
  );
  if (!tokensRes.ok) return Response.json({ sent: 0, reason: "no-token-table" });
  const tokens = (await tokensRes.json()) as Token[];
  if (tokens.length === 0) return Response.json({ sent: 0, reason: "no-devices" });

  const jwt = await providerToken(teamId, keyId, privateKey);
  const dead = new Set<string>();
  const ok = new Set<string>();
  let sent = 0;
  for (const alert of alerts) {
    const results = await Promise.all(
      tokens
        .filter((t) => !dead.has(t.id))
        .map(async (t) => ({ t, r: await send(t, alert, jwt, bundleId).catch(() => null) })),
    );
    let reached = false;
    for (const { t, r } of results) {
      if (r?.ok) {
        ok.add(t.id);
        reached = true;
      } else if (r?.dead) dead.add(t.id);
      else console.error(`[apns] token=${t.id} status=${r?.status} reason=${r?.reason}`);
    }
    if (reached) sent += 1;
  }

  if (dead.size > 0) {
    await rest(`native_push_tokens?id=in.(${[...dead].join(",")})`, { method: "DELETE" });
  }
  if (ok.size > 0) {
    await rest(`native_push_tokens?id=in.(${[...ok].join(",")})`, {
      method: "PATCH",
      body: JSON.stringify({ failure_count: 0, last_success_at: new Date().toISOString() }),
    });
  }
  return Response.json({ sent, devices: tokens.length, removed: dead.size });
});
