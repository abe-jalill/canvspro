import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "What do you want on your dashboard?" on iPhone, and sharing the layout with the website.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const views = read("ios/App/App/NativeViews.swift");
const features = read("ios/App/App/NativeFeatures.swift");
const more = read("ios/App/App/NativeMoreViews.swift");

test("every account picks its widgets once, after Canvas is connected and the intro closes", () => {
  assert.match(views, /features\.preferencesLoaded && !features\.dashboardPicked && !store\.isPreview && !widgetPickerSkipped &&\s*!store\.needsCanvasConnection && !launchIsVisible && !store\.showsSkeleton/);
  // "Why did you download CoursePro?" replaced the widget list; the answers pick the widgets.
  assert.match(views, /NativeDownloadReasonsView\(features: features, onDone: \{ showWidgetPicker = false \}, onSkip: \{[\s\S]*?\}\)\s*\.interactiveDismissDisabled\(\)/);
  // If saving fails (offline), "Not now" lets the student past it; it asks again next launch.
  assert.match(views, /Button\("Not now, ask me later", action: onSkip\)/);
  assert.match(views, /Why did you download CoursePro\?/);
  assert.match(views, /This is used to customize your dashboard/);
  assert.match(views, /Button\("Skip for now"\) \{ save\(skip: true\) \}/);
  assert.match(views, /try await features\.saveDownloadReasons\(answers\)\s+try await features\.saveDashboardPlan\(widgets\)/);
  // Settings > Dashboard still offers the widget list.
  assert.match(views, /What do you want on your dashboard\?/);
  assert.match(features, /if picked \{ layout\["picked_at"\] = \.string\(/);
  // Saved settings must have loaded first, so nobody who already chose is asked again.
  assert.match(features, /preferences = try await api\.preferences\(token: token, userID: user\.id\)\s*preferencesLoaded = true/);
});

test("the layout syncs with the website unless turned off in Settings", () => {
  assert.match(features, /if case \.some\(\.bool\(let value\)\) = preferences\["dashboard-sync"\] \{ return value \}\s*return true/);
  assert.match(features, /dashboardSyncsWithWebsite \? "dashboard-layout" : "dashboard-layout-iphone"/);
  assert.match(features, /try await savePreference\(dashboardKey, JSONValue\.object\(layout\)\)/);
  // Turning sync off starts from a copy; turning it on asks whose layout to keep.
  assert.match(features, /savePreference\("dashboard-layout-iphone", preferences\["dashboard-layout"\]/);
  assert.match(views, /Keep the website's/);
  assert.match(views, /Keep this iPhone's/);
  assert.match(more, /settingsLink\("Dashboard", "square\.grid\.2x2"\) \{ NativeDashboardSettingsView\(features: features\) \}/);
});

test("the same ten answers as the website, three to five widgets, GPA left to the website", () => {
  const reasons = [...features.matchAll(/Reason\(id: "([a-z]+)", label: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(reasons, ["deadlines", "grades", "plan", "procrastination", "study", "overview", "announcements", "balance", "gpa", "stress"]);
  assert.match(features, /static let maxRecommended = 5/);
  assert.match(features, /for widget in fallback where picks\.count < 3 && available\(widget\) && !picks\.contains\(widget\)/);
  assert.match(views, /NativeDownloadReasons\.recommend\(picked, order: NativeFeatureStore\.defaultDashboardOrder\) \{ features\.pickableDashboardWidgets\.contains\(\$0\) \}/);
  assert.match(features, /savePreference\("download-reasons", ids\)/);
});
