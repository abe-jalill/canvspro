import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import {
  appleClientSecret,
  appleSignInConfig,
  revokeAppleAuthorization,
} from "../src/lib/apple-sign-in.server.ts";
import { handleMobileDeletion } from "../src/lib/mobile-api.ts";

const crypto = globalThis.crypto ?? webcrypto;

async function testKey() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\\n${Buffer.from(der).toString("base64")}\\n-----END PRIVATE KEY-----`;
  return { pem, publicKey: pair.publicKey };
}

const fromB64url = (part) => Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64");

test("the client secret is an ES256 JWT Apple can verify", async () => {
  const { pem, publicKey } = await testKey();
  const config = { teamId: "TEAM123456", keyId: "KEY1234567", privateKey: pem, clientId: "app.canvaspro.mobile" };
  const jwt = await appleClientSecret(config, Date.UTC(2026, 9, 19));
  const [header, payload, signature] = jwt.split(".");
  assert.deepEqual(JSON.parse(fromB64url(header)), { alg: "ES256", kid: "KEY1234567" });
  const claims = JSON.parse(fromB64url(payload));
  assert.equal(claims.iss, "TEAM123456");
  assert.equal(claims.sub, "app.canvaspro.mobile");
  assert.equal(claims.aud, "https://appleid.apple.com");
  assert.equal(claims.exp - claims.iat, 300);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    fromB64url(signature),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  assert.equal(valid, true);
});

test("the secrets are optional and default to the app's bundle ID", () => {
  assert.equal(appleSignInConfig({}), null);
  assert.equal(
    appleSignInConfig({ APPLE_TEAM_ID: "T", APPLE_KEY_ID: "K", APPLE_PRIVATE_KEY: "P" }).clientId,
    "app.canvaspro.mobile",
  );
});

test("deleting an Apple account exchanges the code and revokes the refresh token", async () => {
  const { pem } = await testKey();
  const config = { teamId: "T", keyId: "K", privateKey: pem, clientId: "app.canvaspro.mobile" };
  const calls = [];
  await revokeAppleAuthorization("one-time-code", config, async (url, init) => {
    calls.push([url, Object.fromEntries(new URLSearchParams(init.body))]);
    return url.endsWith("/auth/token")
      ? Response.json({ refresh_token: "r-token", access_token: "a-token" })
      : new Response(null, { status: 200 });
  });
  assert.equal(calls[0][0], "https://appleid.apple.com/auth/token");
  assert.equal(calls[0][1].grant_type, "authorization_code");
  assert.equal(calls[0][1].code, "one-time-code");
  assert.equal(calls[1][0], "https://appleid.apple.com/auth/revoke");
  assert.equal(calls[1][1].token, "r-token");
  assert.equal(calls[1][1].token_type_hint, "refresh_token");

  await assert.rejects(
    revokeAppleAuthorization("bad", config, async () =>
      Response.json({ error: "invalid_grant" }, { status: 400 }),
    ),
    /invalid_grant/,
  );
});

function deletion(body) {
  return new Request("https://canvaspro.app/api/mobile/delete-account", {
    method: "POST",
    headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("the account is deleted after Apple is revoked, even if Apple fails", async () => {
  const steps = [];
  const ok = await handleMobileDeletion(
    deletion({ confirm: "DELETE", appleAuthorizationCode: "code" }),
    async () => "user-1",
    async (id) => steps.push(`delete ${id}`),
    async (code) => steps.push(`revoke ${code}`),
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(steps, ["revoke code", "delete user-1"]);

  steps.length = 0;
  const original = console.error;
  console.error = () => {};
  const stillDeleted = await handleMobileDeletion(
    deletion({ confirm: "DELETE", appleAuthorizationCode: "code" }),
    async () => "user-1",
    async (id) => steps.push(`delete ${id}`),
    async () => {
      throw new Error("Apple is down");
    },
  );
  console.error = original;
  assert.equal(stillDeleted.status, 200);
  assert.deepEqual(steps, ["delete user-1"]);

  // Email accounts send no code and never reach Apple.
  steps.length = 0;
  await handleMobileDeletion(
    deletion({ confirm: "DELETE" }),
    async () => "user-2",
    async (id) => steps.push(`delete ${id}`),
    async () => steps.push("revoke"),
  );
  assert.deepEqual(steps, ["delete user-2"]);
});
