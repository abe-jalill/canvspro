import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("native tabs remain a compact projection of website navigation", () => {
  const tabs = source("ios/App/App/NativeViews.swift");
  const more = source("ios/App/App/NativeMoreViews.swift");

  // Today, the student's two or three picks (To-Do, Study Session and Grades to start), More.
  assert.match(tabs, /static func tabs\(_ raw: String\) -> \[NativeTab\] \{ \[\.today\] \+ middle\(raw\) \+ \[\.more\] \}/);
  assert.match(tabs, /static let maxMiddle = 3/);
  assert.match(tabs, /return \(2\.\.\.maxMiddle\)\.contains\(picked\.count\) \? picked : defaultMiddle/);
  assert.match(tabs, /static let defaultMiddle: \[NativeTab\] = \[\.todo, \.study, \.grades\]/);
  assert.match(tabs, /static let choices: \[NativeTab\] = \[\.todo, \.study, \.grades, \.files, \.announcements, \.calendar, \.classes\]/);
  // A new key, so everyone gets To-Do as a tab once.
  assert.match(tabs, /static let key = "CanvasProTabBar\.v2"/);
  assert.equal((tabs.match(/\.tabItem\s*\{/g) ?? []).length, 1, "one ForEach builds every tab");
  assert.ok(!tabs.includes('Label("Profile"'), "Profile is not a bottom tab");
  // Every page not in the tab bar is a tile in More, plus Completed.
  assert.match(more, /NativeTabBar\.choices\.filter \{ !inTabBar\.contains\(\$0\) \} \+ \[\.completed\]/);
  assert.ok(more.includes(".navigationDestination(item: $destination)"));
  for (const title of ["Notifications", "Tab bar", "Settings", "Help & Support"]) {
    assert.ok(more.includes(`NativeMenuRow(title: "${title}"`), `${title} is reachable through More`);
  }
  assert.ok(more.includes('settingsLink("Tab bar", "dock.rectangle")'), "Settings has the tab bar choice");
  assert.ok(!more.includes('NativeMenuRow(title: "Assignments"'), "Assignments lives in Today");
  assert.ok(!more.includes('NativeMenuRow(title: "Get It Done"'), "Get It Done belongs inside Today");
  // Calendar and Class Schedule are separate pages, each opened on its own.
  assert.ok(tabs.includes('case .classes: return "My Classes"'));
  assert.ok(tabs.includes("NavigationStack { CalendarView(store: contentStore, features: featureStore) }"));
  assert.ok(tabs.includes("NavigationStack { ClassScheduleView(features: featureStore, store: contentStore) }"));
  assert.ok(more.includes("case .calendar: CalendarView(store: store, features: features)"));
  assert.ok(more.includes("case .classes: ClassScheduleView(features: features, store: store)"));
  // Today is the dashboard; Get It Done became its Next up. To-Do is a tab.
  assert.ok(!tabs.includes('"Get It Done"'));
  assert.ok(tabs.includes('if path.contains("get-it-done") { selection = .today }'));
  assert.ok(tabs.includes('path.contains("assignment") || path.contains("todo") { open(.todo) }'));
  // Links and notifications open the page's tab, or More when it isn't one.
  assert.match(tabs, /if NativeTabBar\.tabs\(tabBarRaw\)\.contains\(page\) \{\s*selection = page\s*\} else \{\s*moreDestination = page\s*selection = \.more/);
  assert.ok(tabs.includes('else if path.contains("announcement") { open(.announcements) }'));
  assert.ok(!/selection = \.(todo|grades|study|files|announcements|calendar)\b/.test(tabs), "never jumps to a tab that may not exist");
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

test("More's profile card shows the school and Freshman to Senior from the class year", () => {
  const features = source("ios/App/App/NativeFeatures.swift");
  const more = source("ios/App/App/NativeMoreViews.swift");
  assert.match(features, /let finalYear = month >= 8 \? current \+ 1 : current/);
  assert.match(features, /case 0: return "Senior"\s*case 1: return "Junior"\s*case 2: return "Sophomore"\s*case 3: return "Freshman"\s*default: return "Class of \\\(year\)"/);
  assert.match(more, /if let schoolLine = features\.accountDetails\.schoolLine \{/);
  assert.match(more, /Text\("Add your school and year"\)/);
});

test("Calendar rows: a time column that grows with Text Size, then the title and one line", () => {
  const more = source("ios/App/App/NativeMoreViews.swift");
  const calendar = more.slice(more.indexOf("struct CalendarView: View"), more.indexOf("struct WorkloadView: View"));
  assert.doesNotMatch(calendar, /\.frame\(width: 50/);
  assert.match(calendar, /@ScaledMetric\(relativeTo: \.footnote\) private var timeWidth: CGFloat = 66/);
  assert.match(calendar, /\.frame\(width: timeWidth, alignment: \.trailing\)/);
  assert.doesNotMatch(calendar, /"Show completed"|WorkloadView\(|NativeCachedEstimateEditor/);
  assert.match(calendar, /CPChip\(text: "Today", selected: isOnToday\)/);
  assert.match(calendar, /\.cpNavigationTitle\("Calendar"\)/);
  // Class Schedule: each class once per day it meets; edit or delete it from there.
  const schedule = more.slice(more.indexOf("struct ClassScheduleView: View"), more.indexOf("enum NativeScheduleActions"));
  assert.doesNotMatch(schedule, /Section\("Edit or remove"\)/);
  assert.match(schedule, /Button\("Delete class", role: \.destructive\)/);
});

test("the Next up card holds Start and its time estimate inside it", () => {
  const views = source("ios/App/App/NativeViews.swift");
  const card = views.slice(views.indexOf("private var nextUpCard: some View"), views.indexOf("private var nextUpLabel: some View"));
  // Start (what Get It Done did) is the card's last row, before its own padding
  // and background close; the estimate is in the details line above it.
  assert.match(card, /NotificationCenter\.default\.post\(name: \.nativeStudyAssignment, object: item\)/);
  assert.match(card, /Text\(nextUpDetail\(item\)\)/);
  assert.match(card, /\.accessibilityHint\("Opens Study with this assignment"\)\s*\} else \{[\s\S]*\}\s*\}\s*\.padding\(18\)\s*\.frame\(maxWidth: \.infinity, alignment: \.leading\)[\s\S]*?\.background \{ CPCardLight\(\) \}\s*\.background\(CPTheme\.accentCardGradient\(scheme\)/);
});
