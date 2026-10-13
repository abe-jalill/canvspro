import assert from "node:assert/strict";
import test from "node:test";
import {
  SIGNUP_SOURCE_KEY,
  captureSignupSource,
  clearSignupSource,
  signupSourceMetadata,
  summarizeSignupSources,
} from "../src/lib/signup-source.ts";

function memoryStorage() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  };
}

const now = new Date("2026-10-12T20:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

test("a tagged visit is remembered with the landing page and referring site only", () => {
  const storage = memoryStorage();
  const saved = captureSignupSource(
    "https://canvaspro.app/canvas-grade-calculator?utm_source=meta&utm_medium=paid_social&utm_campaign=fall&fbclid=abc",
    "https://l.facebook.com/l.php?u=secret-path",
    storage,
    now,
  );
  assert.deepEqual(saved, {
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: "fall",
    landing_path: "/canvas-grade-calculator",
    referrer_host: "l.facebook.com",
    captured_at: now.toISOString(),
  });
  assert.doesNotMatch(storage.getItem(SIGNUP_SOURCE_KEY), /fbclid|abc|secret-path/);
});

test("untagged visits and our own pages as referrer are not recorded", () => {
  const storage = memoryStorage();
  assert.equal(captureSignupSource("https://canvaspro.app/?ref=x", "", storage, now), null);
  assert.equal(storage.items.size, 0);
  const saved = captureSignupSource(
    "https://canvaspro.app/?utm_source=google",
    "https://canvaspro.app/privacy",
    storage,
    now,
  );
  assert.equal(saved.referrer_host, undefined);
});

test("the first tagged visit keeps the credit until it expires after 30 days", () => {
  const storage = memoryStorage();
  captureSignupSource("https://canvaspro.app/?utm_source=meta", "", storage, now);
  const later = new Date(now.getTime() + 5 * DAY);
  assert.equal(
    captureSignupSource("https://canvaspro.app/?utm_source=google", "", storage, later),
    null,
  );
  assert.equal(signupSourceMetadata(storage, later).signup_source.utm_source, "meta");

  const expired = new Date(now.getTime() + 31 * DAY);
  assert.deepEqual(signupSourceMetadata(storage, expired), {});
  assert.equal(
    captureSignupSource("https://canvaspro.app/?utm_source=google", "", storage, expired)
      .utm_source,
    "google",
  );
});

test("values are trimmed, stripped of control characters and capped", () => {
  const storage = memoryStorage();
  const long = "x".repeat(250);
  const saved = captureSignupSource(
    `https://canvaspro.app/?utm_source=%20tiktok%0A&utm_campaign=${long}`,
    "",
    storage,
    now,
  );
  assert.equal(saved.utm_source, "tiktok");
  assert.equal(saved.utm_campaign.length, 100);
});

test("blocked or broken storage never throws", () => {
  const throwing = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(captureSignupSource("https://canvaspro.app/?utm_source=a", "", throwing, now), null);
  assert.deepEqual(signupSourceMetadata(throwing, now), {});
  assert.doesNotThrow(() => clearSignupSource(throwing));
  assert.deepEqual(signupSourceMetadata(undefined, now), {});

  const corrupt = memoryStorage();
  corrupt.setItem(SIGNUP_SOURCE_KEY, "{not json");
  assert.deepEqual(signupSourceMetadata(corrupt, now), {});
});

test("sign-up clears the remembered campaign", () => {
  const storage = memoryStorage();
  captureSignupSource("https://canvaspro.app/?utm_source=meta", "", storage, now);
  clearSignupSource(storage);
  assert.deepEqual(signupSourceMetadata(storage, now), {});
});

test("the admin summary counts sign-ups and Canvas connections per campaign", () => {
  const rows = summarizeSignupSources(
    [
      {
        id: "a",
        signupSource: { utm_source: "meta", utm_medium: "paid_social", utm_campaign: "fall" },
      },
      {
        id: "b",
        signupSource: { utm_source: "meta", utm_medium: "paid_social", utm_campaign: "fall" },
      },
      { id: "c", signupSource: { utm_source: "google" } },
      { id: "d" },
      { id: "e", signupSource: { utm_source: 42, utm_campaign: ["x"] } },
    ],
    new Set(["a", "c"]),
  );
  assert.deepEqual(rows, [
    { source: "direct", medium: "", campaign: "", signups: 2, connected: 0 },
    { source: "meta", medium: "paid_social", campaign: "fall", signups: 2, connected: 1 },
    { source: "google", medium: "", campaign: "", signups: 1, connected: 1 },
  ]);
});
