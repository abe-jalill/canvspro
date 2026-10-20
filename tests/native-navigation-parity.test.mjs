import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("native tabs remain a compact projection of website navigation", () => {
  const tabs = source("ios/App/App/NativeViews.swift");
  const more = source("ios/App/App/NativeMoreViews.swift");

  // Four tabs: Today, the student's two picks (Study Session and Grades to start), More.
  assert.match(tabs, /static func tabs\(_ raw: String\) -> \[NativeTab\] \{ \[\.today\] \+ middle\(raw\) \+ \[\.more\] \}/);
  assert.match(tabs, /static let defaultMiddle: \[NativeTab\] = \[\.study, \.grades\]/);
  assert.match(tabs, /static let choices: \[NativeTab\] = \[\.study, \.grades, \.files, \.announcements, \.calendar\]/);
  assert.equal((tabs.match(/\.tabItem\s*\{/g) ?? []).length, 1, "one ForEach builds every tab");
  assert.ok(!tabs.includes('Label("Profile"'), "Profile is not a bottom tab");
  // Every page not in the tab bar is a tile in More, plus Completed and My classes.
  assert.match(more, /NativeTabBar\.choices\.filter \{ !inTabBar\.contains\(\$0\) \} \+ \[\.completed\]/);
  assert.ok(more.includes(".navigationDestination(item: $destination)"));
  for (const title of ["My classes", "Notifications", "Tab bar", "Settings", "Help & Support"]) {
    assert.ok(more.includes(`NativeMenuRow(title: "${title}"`), `${title} is reachable through More`);
  }
  assert.ok(more.includes('settingsLink("Tab bar", "dock.rectangle")'), "Settings has the tab bar choice");
  assert.ok(!more.includes('NativeMenuRow(title: "Assignments"'), "Assignments lives in Today");
  assert.ok(!more.includes('NativeMenuRow(title: "Get It Done"'), "Get It Done belongs inside Today");
  assert.ok(!more.includes('NativeMenuRow(title: "Class Schedule"'), "My classes belongs inside Calendar");
  assert.ok(tabs.includes('options: ["Dashboard", "Assignments", "Get It Done"]'));
  assert.ok(more.includes('options: ["Calendar", "My classes"]'));
  assert.ok(tabs.includes('todaySection = "Assignments"; selection = .today'));
  // Links and notifications open the page's tab, or More when it isn't one.
  assert.match(tabs, /if NativeTabBar\.tabs\(tabBarRaw\)\.contains\(page\) \{\s*selection = page\s*\} else \{\s*moreDestination = page\s*selection = \.more/);
  assert.ok(tabs.includes('else if path.contains("announcement") { open(.announcements) }'));
  assert.ok(!/selection = \.(grades|study|files|announcements|calendar)\b/.test(tabs), "never jumps to a tab that may not exist");
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
