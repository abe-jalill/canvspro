import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fillNoise, normalizeNoisePrefs } from "../src/lib/focus-noise.ts";

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

test("noise is off by default and bad saved values fall back safely", () => {
  assert.deepEqual(normalizeNoisePrefs(null), { kind: "off", volume: 0.5 });
  assert.deepEqual(normalizeNoisePrefs({ kind: "pink", volume: 9 }), { kind: "off", volume: 1 });
  assert.deepEqual(normalizeNoisePrefs({ kind: "brown", volume: 0.2 }), {
    kind: "brown",
    volume: 0.2,
  });
});

test("white and brown noise stay in range; brown is much smoother", () => {
  const white = fillNoise("white", 48_000, seeded(7));
  const brown = fillNoise("brown", 48_000, seeded(7));
  const roughness = (data) => {
    let sum = 0;
    for (let i = 1; i < data.length; i++) sum += Math.abs(data[i] - data[i - 1]);
    return sum / (data.length - 1);
  };
  for (const data of [white, brown]) {
    assert.ok(data.every((v) => v >= -1 && v <= 1));
  }
  // Sample-to-sample change: brown is ~19x calmer than white.
  assert.ok(roughness(brown) * 10 < roughness(white));
});

test("brown noise loops without a click at the seam", () => {
  const brown = fillNoise("brown", 48_000, seeded(3));
  const seam = Math.abs(brown[brown.length - 1] - brown[0]);
  assert.ok(seam < 1e-4, `seam jump ${seam}`);
});

test("the player runs app-wide and the controls sit on the running session", () => {
  const layout = readFileSync(
    new URL("../src/routes/_authenticated/route.tsx", import.meta.url),
    "utf8",
  );
  const page = readFileSync(
    new URL("../src/routes/_authenticated/study-session.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(layout.includes("<FocusNoisePlayer />"));
  assert.ok(page.includes("<FocusNoiseControls"));
});
