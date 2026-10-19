import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the website asks once what goes on the dashboard and keeps the picked mark", () => {
  const layout = read("src/lib/dashboard-layout.ts");
  const page = read("src/routes/_authenticated/dashboard.tsx");
  const picker = read("src/components/dashboard-widget-picker.tsx");
  // The website's edits used to drop unknown fields; picked_at (also set by the iPhone app) must survive them.
  assert.match(layout, /const picked_at = typeof raw\?\.picked_at === "string" \? raw\.picked_at : undefined;/);
  assert.match(layout, /needsPicks: ready && !layout\.picked_at/);
  assert.match(page, /\{layout\.needsPicks && \(\s*<DashboardWidgetPicker open order=\{layout\.order\} initial=\{visible\} onSave=\{layout\.savePicks\} \/>/);
  assert.match(picker, /What do you want on your dashboard\?/);
  assert.match(picker, /We recommend 4 or 5\./);
  assert.match(picker, /onPointerDownOutside=\{\(event\) => event\.preventDefault\(\)\}/);
});
