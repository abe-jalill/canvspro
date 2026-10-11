import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, htmlToText } from "../src/lib/html-text.ts";

test("Canvas previews decode named, decimal, and either-case hexadecimal entities", () => {
  assert.equal(decodeEntities("&amp; &nbsp; &#233; &#xE9; &#XE9; &#128218;"), "&   é é é 📚");
});

test("invalid Unicode references cannot crash a description preview", () => {
  for (const entity of [
    "&#1114112;",
    "&#x110000;",
    "&#0;",
    "&#55296;",
    "&#xDFFF;",
    `&#${"9".repeat(400)};`,
  ]) {
    assert.equal(htmlToText(`<p>Before ${entity} after</p>`), "Before � after");
  }
  assert.equal(decodeEntities("&#x10FFFF;"), String.fromCodePoint(0x10ffff));
});

test("unknown and malformed entities remain readable rather than being partially decoded", () => {
  const text = "&unknown; &#12af; &#xZZ; &#X; &#-1;";
  assert.equal(decodeEntities(text), text);
});

test("HTML previews preserve paragraph breaks and decode escaped markup as text", () => {
  assert.equal(
    htmlToText("<p>Read&nbsp;chapter &#X32;.</p><p>&lt;example&gt;<br>Next &amp; last</p>"),
    "Read chapter 2.\n<example>\nNext & last",
  );
});
