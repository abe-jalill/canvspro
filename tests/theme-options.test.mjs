import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import {
  PALETTES,
  normalizePalette,
  normalizeThemeMode,
  normalizeWallpaper,
  resolveTheme,
} from "../src/lib/theme-options.ts";

test("wallpaper is on by default and only an explicit 'plain' turns it off", () => {
  assert.equal(normalizeWallpaper(undefined), "wave");
  assert.equal(normalizeWallpaper("junk"), "wave");
  assert.equal(normalizeWallpaper("plain"), "plain");
});

test("every palette has a dark and a light wallpaper wired up", () => {
  const css = readFileSync(new URL("../src/targeted-design.css", import.meta.url), "utf8");
  for (const { id } of PALETTES) {
    for (const mode of ["dark", "light"]) {
      const file = `/wallpapers/${id}-${mode}.webp`;
      assert.ok(existsSync(new URL(`../public${file}`, import.meta.url)), `${file} missing`);
      assert.ok(css.includes(`:root.${mode}[data-palette="${id}"] { --wallpaper: url("${file}"); }`));
    }
  }
});

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
