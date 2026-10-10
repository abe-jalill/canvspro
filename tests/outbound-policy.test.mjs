import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  canvasRequestInit,
  isAllowedCanvasHost,
  isPushServiceEndpoint,
  normalizeCanvasDomain,
  safeReturnPath,
} from "../src/lib/outbound-policy.ts";

const ORIGIN = "https://canvaspro.app";

test("sign-in only returns to pages on this site", () => {
  assert.equal(
    safeReturnPath("/.lovable/oauth/consent?authorization_id=abc", ORIGIN),
    "/.lovable/oauth/consent?authorization_id=abc",
  );
  // Each of these would leave the site after sign-in.
  for (const raw of [
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\\/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "",
    null,
  ]) {
    assert.equal(safeReturnPath(raw, ORIGIN), null, `accepted ${JSON.stringify(raw)}`);
  }
});

test("background checks only send a student's Canvas key to a Canvas school", () => {
  assert.ok(isAllowedCanvasHost("lawrencetech.instructure.com", []));
  assert.ok(!isAllowedCanvasHost("instructure.com", []));
  assert.ok(!isAllowedCanvasHost("attacker.example", []));
  assert.ok(!isAllowedCanvasHost("instructure.com.attacker.example", []));
  assert.ok(isAllowedCanvasHost("canvas.myschool.edu", ["https://canvas.myschool.edu/"]));
  assert.equal(normalizeCanvasDomain("school.instructure.com@attacker.example"), "");
  assert.equal(normalizeCanvasDomain("school.instructure.com:8443"), "");
});

test("push is only sent to real browser push services", () => {
  for (const ok of [
    "https://web.push.apple.com/QAbc",
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-by3p.notify.windows.com/w/?token=abc",
  ]) {
    assert.ok(isPushServiceEndpoint(ok), ok);
  }
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/fcm/send/abc",
    "https://fcm.googleapis.com.attacker.example/x",
    "https://attacker.example/push",
    "https://169.254.169.254/latest",
    "not a url",
  ]) {
    assert.ok(!isPushServiceEndpoint(bad), bad);
  }
});

test("background Canvas requests follow Cloudflare Workers' fetch rules", () => {
  const init = canvasRequestInit("token-123");
  // Workers throws on any other redirect mode; "manual" never forwards the token.
  assert.equal(init.redirect, "manual");
  const headers = new Headers(init.headers);
  assert.equal(headers.get("Authorization"), "Bearer token-123");
  // Workers sends no User-Agent; school firewalls answer an HTML 403 without one.
  assert.match(headers.get("User-Agent") ?? "", /^CanvasPro\/\d/);
});

test("server code never uses fetch redirect mode 'error' (Cloudflare Workers throws on it)", () => {
  // workerd: 'Invalid redirect value, must be one of "follow" or "manual"'.
  // It once failed every closed-app check. Deno edge functions may use it.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry.name) && /redirect:\s*["']error["']/.test(readFileSync(path, "utf8"))) {
        offenders.push(path);
      }
    }
  };
  walk(fileURLToPath(new URL("../src", import.meta.url)));
  assert.deepEqual(offenders, []);
});

test("the server enforces these rules where it sends", () => {
  const dispatch = readFileSync(
    new URL("../src/routes/api/public/push/dispatch.ts", import.meta.url),
    "utf8",
  );
  assert.ok(dispatch.includes("isAllowedCanvasHost(userDomain, configuredDomains)"));
  assert.ok(dispatch.includes("userSubs.filter((s) => isPushServiceEndpoint(s.endpoint))"));
  const pushServer = readFileSync(
    new URL("../src/lib/push-dispatch.server.ts", import.meta.url),
    "utf8",
  );
  // Its options (redirect "manual", User-Agent) are tested directly above.
  assert.ok(pushServer.includes("canvasRequestInit(token)"));

  // Checking a typed-in Canvas key still needs a signed-in caller.
  const edge = readFileSync(
    new URL("../supabase/functions/canvas/index.ts", import.meta.url),
    "utf8",
  );
  assert.ok(edge.includes('if (resource === "validate" && overrideToken) await requireUserId(req);'));

  // The live site can't be framed (clickjacking of the OAuth consent screen).
  const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
  assert.ok(server.includes("frame-ancestors 'none'"));
});
