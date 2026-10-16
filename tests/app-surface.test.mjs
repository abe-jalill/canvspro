import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { APP_SECTIONS, SURFACE_BOOT, surfaceFor } from "../src/lib/app-surface.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("only signed-in pages are the app; everything else is the site", () => {
  for (const path of [
    "/dashboard",
    "/settings/billing",
    "/courses/12",
    "/study-session",
    "/grades",
  ]) {
    assert.equal(surfaceFor(path), "app", path);
  }
  for (const path of [
    "/",
    "/pricing",
    "/support",
    "/terms",
    "/privacy",
    "/auth",
    "/signup",
    "/canvas-grade-calculator",
    "/nope",
  ]) {
    assert.equal(surfaceFor(path), "site", path);
  }
});

test("every signed-in route is listed", () => {
  const sections = new Set(
    readdirSync(new URL("../src/routes/_authenticated/", import.meta.url))
      .filter((file) => file !== "route.tsx")
      .map((file) => file.split(".")[0]),
  );
  assert.deepEqual([...sections].sort(), [...APP_SECTIONS].sort());
});

test("the boot script picks the surface before the first paint, with the same rule", () => {
  const root = read("src/routes/__root.tsx");
  assert.match(root, /const themeBootScript = `try\{\$\{SURFACE_BOOT\}\}catch\(e\)\{\}try\{/);
  const html = { dataset: {} };
  for (const [path, surface] of [
    ["/dashboard/x", "app"],
    ["/", "site"],
    ["/pricing", "site"],
  ]) {
    new Function("document", "location", SURFACE_BOOT)(
      { documentElement: html },
      { pathname: path },
    );
    assert.equal(html.dataset.surface, surface, path);
  }
});

test("the wallpaper and palette tint stay behind the signed-in app", () => {
  const css = read("src/targeted-design.css");
  assert.match(
    css,
    /:root\[data-surface="app"\]\[data-palette\]\[data-wallpaper="wave"\] body::before/,
  );
  assert.doesNotMatch(css, /^:root\[data-palette\]\[data-wallpaper="wave"\] body::before/m);
  assert.match(
    css,
    /:root:not\(\[data-surface="app"\]\)\[data-palette\] body::before \{\s*background: #0c0d0f;/,
  );
});
