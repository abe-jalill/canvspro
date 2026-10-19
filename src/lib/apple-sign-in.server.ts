/**
 * Sign in with Apple, server side. Apple requires an app that offers Sign in
 * with Apple to revoke the user's Apple tokens when they delete their account
 * (App Store Review Guideline 5.1.1(v)). The iPhone app asks Apple for a fresh
 * authorization code when an Apple account is deleted; this exchanges that code
 * for a refresh token and revokes it, so the app disappears from the person's
 * "Sign in with Apple" list in their Apple Account settings.
 *
 * Secrets (from the Apple Developer account, Keys > Sign in with Apple):
 *   APPLE_TEAM_ID      10-character Team ID
 *   APPLE_KEY_ID       the key's 10-character Key ID
 *   APPLE_PRIVATE_KEY  the .p8 file's contents (PEM, newlines or \n escapes)
 *   APPLE_CLIENT_ID    optional; the iPhone app's bundle ID by default
 *
 * Runs on Cloudflare Workers, so it signs with WebCrypto and uses plain fetch.
 */

const APPLE_AUTH = "https://appleid.apple.com";
const DEFAULT_CLIENT_ID = "app.canvaspro.mobile";

export interface AppleSignInConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
  clientId: string;
}

export function appleSignInConfig(
  env: Record<string, string | undefined> = process.env,
): AppleSignInConfig | null {
  const teamId = env.APPLE_TEAM_ID?.trim();
  const keyId = env.APPLE_KEY_ID?.trim();
  const privateKey = env.APPLE_PRIVATE_KEY?.trim();
  if (!teamId || !keyId || !privateKey) return null;
  return { teamId, keyId, privateKey, clientId: env.APPLE_CLIENT_ID?.trim() || DEFAULT_CLIENT_ID };
}

function base64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let binary = "";
  for (const byte of raw) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const der = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);
  return der.buffer;
}

/** The ES256-signed client secret Apple's token endpoints expect (valid five minutes). */
export async function appleClientSecret(
  config: AppleSignInConfig,
  now = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = base64url(
    JSON.stringify({
      iss: config.teamId,
      iat: issuedAt,
      exp: issuedAt + 300,
      aud: APPLE_AUTH,
      sub: config.clientId,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(config.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // WebCrypto returns the raw r||s signature JWS ES256 uses, not DER.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Exchanges a one-time authorization code from the app for a refresh token and
 * revokes it. Throws when Apple refuses either step.
 */
export async function revokeAppleAuthorization(
  code: string,
  config: AppleSignInConfig,
  fetchImpl: Fetch = fetch,
): Promise<void> {
  const clientSecret = await appleClientSecret(config);
  const form = (fields: Record<string, string>) => ({
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });

  const tokenRes = await fetchImpl(
    `${APPLE_AUTH}/auth/token`,
    form({
      client_id: config.clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  );
  const tokens = (await tokenRes.json().catch(() => ({}))) as {
    refresh_token?: string;
    access_token?: string;
    error?: string;
  };
  const token = tokens.refresh_token ?? tokens.access_token;
  if (!tokenRes.ok || !token) {
    throw new Error(`Apple token exchange failed: ${tokens.error ?? tokenRes.status}`);
  }

  const revokeRes = await fetchImpl(
    `${APPLE_AUTH}/auth/revoke`,
    form({
      client_id: config.clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
    }),
  );
  if (!revokeRes.ok) throw new Error(`Apple token revocation failed: ${revokeRes.status}`);
}
