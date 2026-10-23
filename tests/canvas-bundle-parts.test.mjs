import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The Canvas function's "all" bundle sends every part unless the caller names
// the ones it wants. The website asks for all four; the iPhone app, which has
// no Calendar, leaves out "calendar".
const source = readFileSync(
  new URL("../supabase/functions/canvas/index.ts", import.meta.url),
  "utf8",
);

test("the bundle sends only the parts asked for, and all four by default", () => {
  assert.match(source, /parts = Array\.isArray\(body\?\.parts\)/);
  for (const part of ["courses", "assignments", "announcements", "calendar"]) {
    assert.match(source, new RegExp(`\\b${part}: \\(\\) => handle`), part);
  }
  assert.match(source, /const names = asked\.length > 0 \? asked : known;/);
  assert.match(source, /Promise\.allSettled\(names\.map\(\(name\) => sections\[name\]\(\)\)\)/);
});

test("the website and the assistant still ask for the whole bundle", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(
    read("src/lib/canvas.functions.ts"),
    /invokeCanvas<CanvasBundle \| unknown\[\]>\("all"\)/,
  );
  assert.match(read("src/lib/mcp/canvas.ts"), /body: JSON\.stringify\(\{ resource: "all" \}\)/);
});
