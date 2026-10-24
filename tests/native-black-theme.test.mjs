import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// Black, the fifth theme, as on the website: true black in Dark, white with
// black in Light, and neutral grays with no palette tint.
const design = readFileSync(new URL("../ios/App/App/NativeDesign.swift", import.meta.url), "utf8");
const more = readFileSync(new URL("../ios/App/App/NativeMoreViews.swift", import.meta.url), "utf8");

test("Black is a theme, saved under the website's name", () => {
  assert.match(design, /case forest, blue, violet, rose, black\n/);
  assert.match(design, /case \.black: "Pure black\. Just your work\."/);
  assert.match(more, /ForEach\(CPPalette\.allCases\)/);
});

test("Black is true black with white, and its grays carry no hue", () => {
  assert.match(design, /if palette == \.black \{ return scheme == \.dark \? \.black : \.hsl\(0, 0, 0\.98\) \}/);
  assert.match(design, /if palette == \.black \{ return \.hsl\(0, 0, scheme == \.dark \? 0\.93 : 0\.09\) \}/);
  assert.match(design, /var tint: Double \{ self == \.black \? 0 : 1 \}/);
  for (const name of ["foreground", "muted", "faint", "glass", "border"]) {
    const start = design.indexOf(`static func ${name}(`);
    const body = design.slice(start, design.indexOf("\n    }", start));
    assert.match(body, /palette\.tint/, name);
  }
});

test("Black has its own wallpaper in both modes", () => {
  for (const mode of ["dark", "light"]) {
    const set = new URL(`../ios/App/App/Assets.xcassets/Wallpaper-black-${mode}.imageset/`, import.meta.url);
    assert.ok(existsSync(new URL(`wallpaper-black-${mode}.jpg`, set)), mode);
    assert.match(readFileSync(new URL("Contents.json", set), "utf8"), new RegExp(`"filename": "wallpaper-black-${mode}\\.jpg"`));
  }
});
