import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedCanvasDomain, normalizeCanvasDomain } from "../supabase/functions/canvas/domain-policy.ts";

test("only configured Canvas hosts can receive a Canvas token", () => {
  assert.equal(isAllowedCanvasDomain("school.instructure.com", []), true);
  assert.equal(isAllowedCanvasDomain("instructure.com.attacker.example", []), false);
  assert.equal(isAllowedCanvasDomain("school.example.edu", []), false);
  assert.equal(isAllowedCanvasDomain("school.example.edu", ["https://school.example.edu"]), true);
  assert.equal(isAllowedCanvasDomain("attacker.example", ["school.example.edu"]), false);
});

test("normalizes HTTPS school URLs and rejects credential or port tricks", () => {
  assert.equal(normalizeCanvasDomain("https://School.Instructure.com/"), "school.instructure.com");
  assert.equal(normalizeCanvasDomain("http://school.instructure.com"), "");
  assert.equal(normalizeCanvasDomain("https://school.instructure.com@attacker.example"), "");
  assert.equal(normalizeCanvasDomain("https://school.instructure.com:8443"), "");
  assert.equal(normalizeCanvasDomain("127.0.0.1"), "");
  assert.equal(normalizeCanvasDomain("school.instructure.com.evil.example"), "school.instructure.com.evil.example");
});
