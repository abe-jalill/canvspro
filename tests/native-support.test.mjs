import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const more = read("ios/App/App/NativeMoreViews.swift");

test("the iPhone Help screen asks the same questions as the website's Support page", () => {
  const web = [...read("src/routes/support.tsx").matchAll(/question: "([^"]+)"/g)].map((m) => m[1]);
  const native = [...more.matchAll(/^\s+\("([^"]+\?|[^"]+\.)",\s*$/gm)].map((m) => m[1]);
  assert.equal(web.length, 7);
  assert.deepEqual(native, web);
  assert.match(more, /static let email = "support@canvaspro\.app"/);
  assert.match(
    read("src/routes/support.tsx"),
    /const REPORT_FORM = "https:\/\/forms\.gle\/7bttezmTW3ji3zFU9"/,
  );
  assert.match(more, /reportForm = URL\(string: "https:\/\/forms\.gle\/7bttezmTW3ji3zFU9"\)/);
  // Answers point at the app's own screens, not the website's.
  assert.doesNotMatch(more, /Add to\s+Home Screen/);
});

test("Help & Support is reachable from More and from Settings", () => {
  assert.match(more, /NativeMenuGroup\("Help"\) \{\s+NavigationLink \{ NativeSupportView\(\) \}/);
  assert.match(
    more,
    /settingsLink\("Help & Support", "questionmark\.circle"\) \{ NativeSupportView\(\) \}/,
  );
  assert.match(read("ios/App/App/NativeViews.swift"), /path\.contains\("support"\)/);
});

test("More has the website's quick settings: mode and streak", () => {
  assert.match(
    more,
    /CPSegmented\(selection: modeSelection, options: \["Light", "Dark", "System"\]/,
  );
  assert.match(more, /features\.savePreference\("theme", value\)/);
  assert.match(more, /NativeStreakRow\(\)/);
  assert.match(read("ios/App/App/NativeCelebrations.swift"), /struct NativeStreakRow: View/);
  // The sample preview shows a mode change too.
  assert.match(
    read("ios/App/App/NativeFeatures.swift"),
    /if isPreview \{ decodePreferenceModels\(\); applyAppearancePreferences\(\); persistPreviewState\(\); return \}/,
  );
});

test("signed-out screens never show the last account's wallpaper", () => {
  const views = read("ios/App/App/NativeViews.swift");
  const reset = views.slice(
    views.indexOf("struct PasswordResetSheet"),
    views.indexOf("struct NativeMainTabView"),
  );
  assert.ok(reset.length > 0);
  assert.doesNotMatch(reset, /CPBackdrop/);
});

test("the iPhone has a plain key guide, done in Safari because the Canvas app can't make keys", () => {
  assert.match(more, /struct NativeCanvasKeyGuide: View/);
  assert.match(more, /Label\("How do I get my key\?"/);
  assert.match(more, /Not the Canvas app; it can't make keys\./);
  assert.match(more, /New Access Token/);
});

test("the Canvas address is never guessed from the email", () => {
  for (const file of [
    "src/components/settings-sections.tsx",
    "src/components/canvas-token-walkthrough.tsx",
  ]) {
    assert.doesNotMatch(read(file), /detectCanvasDomainFromEmail/, file);
  }
  assert.doesNotMatch(more, /detectCanvasDomainFromEmail|fromEmail/);
});
