import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// A server that has just started can fail its first database request. The
// cron's secret lookup and the health check each try once more, so that
// hiccup never skips a notification run or reads as an outage.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the cron secret is read twice before giving up, and a failed read isn't a 401", () => {
  const dispatch = read("src/routes/api/public/push/dispatch.ts");
  assert.match(dispatch, /async function readCronSecret\(admin: Admin\): Promise<string \| null> \{\s+for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(dispatch, /const expected = await readCronSecret\(supabaseAdmin\);/);
  assert.match(dispatch, /if \(expected === null\) \{\s+return Response\.json\(\{ error: "secret lookup failed" \}, \{ status: 503 \}\);/);
  // A wrong or missing secret is still refused.
  assert.match(dispatch, /if \(!expected \|\| !constantTimeEqual\(provided, expected\)\) \{\s+return new Response\("Unauthorized", \{ status: 401 \}\);/);
});

test("the health check tries once more before reporting an error", () => {
  const health = read("src/routes/api/public/push/health.ts");
  assert.match(health, /const problems = await check\(\)\.catch\(async \(first\) => \{[\s\S]*?return check\(\);\s+\}\);/);
  assert.match(health, /problems: \["health-check-error"\]/);
});
