export interface NativePushToken {
  id: string;
  token: string;
  environment: "sandbox" | "production";
}

export interface ApnsConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
}

let cachedJwt: { value: string; createdAt: number; key: string } | null = null;

function base64url(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function providerToken(config: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cacheKey = `${config.teamId}:${config.keyId}`;
  if (cachedJwt && cachedJwt.key === cacheKey && now - cachedJwt.createdAt < 45 * 60) {
    return cachedJwt.value;
  }
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const claims = base64url(JSON.stringify({ iss: config.teamId, iat: now }));
  const input = `${header}.${claims}`;
  const pem = config.privateKey.replace(/\\n/g, "\n");
  const der = Uint8Array.from(
    atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")),
    (character) => character.charCodeAt(0),
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
  const value = `${input}.${base64url(signature)}`;
  cachedJwt = { value, createdAt: now, key: cacheKey };
  return value;
}

export function apnsConfigFromEnv(): ApnsConfig | null {
  const teamId = process.env["APNS_TEAM_ID"]?.trim() ?? "";
  const keyId = process.env["APNS_KEY_ID"]?.trim() ?? "";
  const privateKey = process.env["APNS_PRIVATE_KEY"]?.trim() ?? "";
  const bundleId = process.env["APNS_BUNDLE_ID"]?.trim() || "app.canvaspro.mobile";
  return teamId && keyId && privateKey ? { teamId, keyId, privateKey, bundleId } : null;
}

export async function sendApns(
  target: NativePushToken,
  payload: { title: string; body?: string; to: string; badge?: number | null },
  config: ApnsConfig,
): Promise<{ ok: boolean; expired: boolean; status: number; reason?: string }> {
  const body = JSON.stringify({
      aps: {
        alert: { title: payload.title, ...(payload.body ? { body: payload.body } : {}) },
        sound: "default",
        ...(payload.badge == null ? {} : { badge: payload.badge }),
      },
      to: payload.to,
  });
  const request = async (environment: "sandbox" | "production") => {
    const host = environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
    const response = await fetch(`https://${host}/3/device/${target.token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${await providerToken(config)}`,
        "apns-topic": config.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600),
        "content-type": "application/json",
      },
      body,
    });
    const result = response.ok
      ? {}
      : ((await response.json().catch(() => ({}))) as { reason?: string });
    return { ok: response.ok, status: response.status, reason: result.reason };
  };
  let result = await request(target.environment);
  // Debug/TestFlight/App Store provisioning can change the APNs environment.
  // Try the other gateway before treating an otherwise valid token as dead.
  if (!result.ok && result.reason === "BadDeviceToken") {
    result = await request(target.environment === "sandbox" ? "production" : "sandbox");
  }
  const expired = result.status === 410 || result.reason === "BadDeviceToken" || result.reason === "Unregistered";
  return { ...result, expired };
}

export async function deliverApns(
  tokens: NativePushToken[],
  payload: { title: string; body?: string; to: string; badge?: number | null },
  config: ApnsConfig,
) {
  const report = { dead: [] as string[], failed: [] as string[], delivered: [] as string[] };
  await Promise.all(tokens.map(async (token) => {
    try {
      const result = await sendApns(token, payload, config);
      if (result.ok) report.delivered.push(token.id);
      else if (result.expired) report.dead.push(token.id);
      else {
        report.failed.push(token.id);
        console.error(`[apns] token=${token.id} status=${result.status} reason=${result.reason ?? "unknown"}`);
      }
    } catch (error) {
      report.failed.push(token.id);
      console.error(`[apns] token=${token.id}`, error);
    }
  }));
  return report;
}
