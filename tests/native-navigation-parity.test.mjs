import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("native tabs remain a compact projection of website navigation", () => {
  const tabs = source("ios/App/App/NativeViews.swift");
  const more = source("ios/App/App/NativeMoreViews.swift");

  for (const title of ["Today", "Study Session", "Grades", "Assignments", "More"]) {
    assert.ok(tabs.includes(`Label("${title}"`), `${title} is a native tab`);
  }
  assert.equal((tabs.match(/\.tabItem\s*\{/g) ?? []).length, 5);
  assert.ok(!tabs.includes('Label("Profile"'), "Profile is not a bottom tab");
  for (const title of ["Calendar", "Announcements", "Notifications", "Settings"]) {
    assert.ok(more.includes(`NativeMenuRow(title: "${title}"`), `${title} is reachable through More`);
  }
  assert.ok(!more.includes('NativeMenuRow(title: "Assignments"'), "Assignments has its own tab");
  assert.ok(!more.includes('NativeMenuRow(title: "Get It Done"'), "Get It Done belongs inside Today");
  assert.ok(!more.includes('NativeMenuRow(title: "Class Schedule"'), "My classes belongs inside Calendar");
  assert.ok(tabs.includes('options: ["Dashboard", "Coming Up", "Get It Done"]'));
  assert.ok(more.includes('options: ["Calendar", "My classes"]'));
  assert.ok(tabs.includes('selection = .assignments'));
});

test("website settings sections and profile fields stay reachable in native Settings", () => {
  const website = source("src/routes/_authenticated/settings.index.tsx");
  const native = source("ios/App/App/NativeMoreViews.swift");
  for (const title of ["Appearance", "Profile", "Canvas connection", "Notifications", "Announcements", "Class settings", "AI assistant", "Account"]) {
    assert.ok(website.includes(`title: "${title}"`), `${title} exists on the website`);
    assert.ok(native.includes(`"${title}"`), `${title} exists in native Settings`);
  }
  for (const field of ["Username", "First name", "Last name", "Nickname", "School", "Major", "Class of"]) {
    assert.ok(native.includes(`"${field}"`), `${field} is editable natively`);
  }
  assert.ok(native.includes("PhotosPicker"), "native profile can change its avatar");
  assert.ok(native.includes("usernameAvailable"), "native profile checks username availability");
});
