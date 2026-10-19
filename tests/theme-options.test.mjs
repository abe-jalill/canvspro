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

test("the plain color is the default and only an explicit 'wave' shows the wallpaper", () => {
  assert.equal(normalizeWallpaper(undefined), "plain");
  assert.equal(normalizeWallpaper("junk"), "plain");
  assert.equal(normalizeWallpaper("wave"), "wave");
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

test("the background is one solid color unless Glow or Wallpaper is picked", async () => {
  assert.equal(normalizeWallpaper("glow"), "glow");
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../src/targeted-design.css", import.meta.url), "utf8");
  const base = css.slice(css.indexOf(":root[data-palette] body::before {"), css.indexOf("}", css.indexOf(":root[data-palette] body::before {")));
  assert.doesNotMatch(base, /gradient/);
  assert.match(css, /:root\[data-surface="app"\]\[data-palette\]\[data-wallpaper="glow"\] body::before \{\s*background-image:\s*radial-gradient/);
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /\["wave","glow"\]\.includes\(localStorage\.getItem\("canvas:wallpaper"\)\)/);
});
