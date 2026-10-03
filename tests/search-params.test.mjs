import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSearchWith } from "@tanstack/router-core";
import { searchText } from "../src/lib/search-params.ts";
import { isFocusWindow, normalizeFocusWindow } from "../src/lib/focus-window.ts";

// The same parser configuration the app's router uses (src/router.tsx).
function parseSearchValue(value) {
  if (/^[[{"]/.test(value)) return JSON.parse(value);
  throw new Error("plain search value");
}
const parse = parseSearchWith(parseSearchValue);

test("the router hands number-like URL values back as numbers", () => {
  // This is why a plain `typeof value === "string"` check lost IDs and ranges.
  const search = parse("?window=3&assignment=12345&course=physics");
  assert.equal(search.window, 3);
  assert.equal(search.assignment, 12345);
  assert.equal(search.course, "physics");
});

test("searchText reads a number and its text form the same way", () => {
  assert.equal(searchText(12345), "12345");
  assert.equal(searchText("12345"), "12345");
  assert.equal(searchText("physics"), "physics");
  assert.equal(searchText(""), undefined);
  assert.equal(searchText(undefined), undefined);
  assert.equal(searchText(null), undefined);
  assert.equal(searchText(Number.NaN), undefined);
  assert.equal(searchText({ nested: true }), undefined);
});

test("every Focus range survives the trip through the address bar", () => {
  for (const id of ["overdue", "1", "2", "3", "7", "all"]) {
    const fromUrl = parse(`?window=${id}`).window;
    assert.equal(normalizeFocusWindow(fromUrl), id, `?window=${id}`);
  }
});

test("a bad or missing Focus range falls back to one week", () => {
  for (const bad of [undefined, null, "", "99", 99, "tomorrow", {}]) {
    assert.equal(normalizeFocusWindow(bad), "7");
  }
});

test("only real ranges count as Focus windows", () => {
  assert.equal(isFocusWindow("3"), true);
  assert.equal(isFocusWindow(3), false);
});
