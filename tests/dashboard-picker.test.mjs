import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DOWNLOAD_REASONS, recommendWidgets } from "../src/lib/download-reasons.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ORDER = [
  "digest",
  "classes",
  "upcoming",
  "focus",
  "calendar",
  "announcements",
  "gpa",
  "heatmap",
];

test("the website asks once, after Canvas, why CoursePro, and keeps the picked mark", () => {
  const layout = read("src/lib/dashboard-layout.ts");
  const page = read("src/routes/_authenticated/dashboard.tsx");
  const dialog = read("src/components/download-reasons-dialog.tsx");
  // The website's edits used to drop unknown fields; picked_at (also set by the iPhone app) must survive them.
  assert.match(
    layout,
    /const picked_at = typeof raw\?\.picked_at === "string" \? raw\.picked_at : undefined;/,
  );
  assert.match(layout, /needsPicks: ready && !layout\.picked_at/);
  assert.match(page, /\{layout\.needsPicks && \(\s*<DownloadReasonsDialog/);
  assert.match(page, /layout\.savePlan\(widgets \?\? visible\)/);
  assert.match(dialog, /Why did you download CoursePro\?/);
  assert.match(dialog, /This is used to customize your dashboard/);
  assert.match(dialog, /Skip for now/);
  assert.match(dialog, /onPointerDownOutside=\{\(event\) => event\.preventDefault\(\)\}/);
  // The dashboard only opens once Canvas is connected.
  assert.match(read("src/components/canvas-key-gate.tsx"), /if \(key\) return <>\{children\}<\/>;/);
});

test("ten answers, each pointing at the cards that help with it", () => {
  assert.equal(DOWNLOAD_REASONS.length, 10);
  assert.equal(new Set(DOWNLOAD_REASONS.map((r) => r.id)).size, 10);
  for (const reason of DOWNLOAD_REASONS) {
    assert.ok(
      Object.keys(reason.widgets).every((id) => ORDER.includes(id)),
      reason.id,
    );
  }
});

test("the answers choose three to five cards, most helpful first", () => {
  assert.deepEqual(recommendWidgets(["deadlines"], ORDER), ["focus", "upcoming", "calendar"]);
  assert.deepEqual(recommendWidgets(["gpa"], ORDER), ["gpa", "classes", "digest"]);
  const many = recommendWidgets(
    DOWNLOAD_REASONS.map((r) => r.id),
    ORDER,
  );
  assert.equal(many.length, 5);
  assert.equal(many[0], "focus");
  // A device that doesn't draw GPA (the iPhone) gets the next best instead.
  assert.ok(!recommendWidgets(["gpa"], ORDER, (id) => id !== "gpa").includes("gpa"));
  assert.equal(recommendWidgets(["gpa"], ORDER, (id) => id !== "gpa").length, 3);
  assert.deepEqual(recommendWidgets([], ORDER), ["digest", "focus", "upcoming"]);
});
