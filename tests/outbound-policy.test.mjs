import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
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
  assert.ok(pushServer.includes('redirect: "error"'));

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
