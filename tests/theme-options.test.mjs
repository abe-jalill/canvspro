import assert from "node:assert/strict";
import test from "node:test";
import { PALETTES, normalizePalette, normalizeThemeMode, resolveTheme } from "../src/lib/theme-options.ts";

test("offers exactly the four supported palettes", () => {
  assert.deepEqual(PALETTES.map((palette) => palette.id), ["forest", "blue", "violet", "rose"]);
  assert.equal(normalizePalette("neutral"), "forest");
});

test("existing light and dark preferences remain compatible", () => {
  assert.equal(normalizeThemeMode("light"), "light");
  assert.equal(normalizeThemeMode("dark"), "dark");
  assert.equal(normalizePalette(undefined), "forest");
});
test("invalid account values fall back to Forest and system appearance", () => {
  for (const value of [null, {}, 12, "invalid"]) {
    assert.equal(normalizePalette(value), "forest");
    assert.equal(normalizeThemeMode(value), "system");
  }
});
test("system follows the device while an explicit mode stays fixed", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("light", true), "light");
});
