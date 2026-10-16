import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ipInCidrs } from "../src/lib/billing.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const LIVE = ["34.237.3.244/32", "34.195.105.136/32", "52.11.166.252/32"];

test("only Paddle's listed addresses pass", () => {
  assert.equal(ipInCidrs("34.237.3.244", LIVE), true);
  assert.equal(ipInCidrs("52.11.166.252", LIVE), true);
  assert.equal(ipInCidrs("34.237.3.245", LIVE), false);
  assert.equal(ipInCidrs("1.2.3.4", LIVE), false);
  assert.equal(ipInCidrs("10.0.4.9", ["10.0.0.0/16"]), true);
  assert.equal(ipInCidrs("10.1.0.1", ["10.0.0.0/16"]), false);
  for (const bad of [null, "", "2001:db8::1", "300.1.1.1", "1.2.3", "a.b.c.d"]) {
    assert.equal(ipInCidrs(bad, LIVE), false, String(bad));
  }
  assert.equal(ipInCidrs("34.237.3.244", ["junk", "34.237.3.244/40"]), false);
});

test("the webhook checks the caller against Paddle's live list before anything else", () => {
  const hook = read("src/routes/api/public/paddle/webhook.ts");
  const server = read("src/lib/paddle.server.ts");
  assert.match(server, /fetch\(`\$\{API\[env\]\}\/ips`\)/);
  assert.doesNotMatch(server, /\d+\.\d+\.\d+\.\d+\/32/);
  assert.match(hook, /request\.headers\.get\("cf-connecting-ip"\)/);
  assert.match(
    hook,
    /!ipInCidrs\(caller, cidrs\)\) \{\s+return new Response\("Forbidden", \{ status: 403 \}\)/,
  );
  assert.ok(
    hook.indexOf("Forbidden") < hook.indexOf("verifyPaddleSignature(\n"),
    "IP check runs first",
  );
  assert.match(hook, /verifyPaddleSignature\(/);
});
