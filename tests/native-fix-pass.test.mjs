import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { displayCourseName, displayCourseCode } from "../src/lib/course-display.ts";

// Source invariants for the October 2026 iOS fix pass. Swift itself is compiled
// by Codemagic; these guard the decisions that must not regress.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const swiftFiles = ["NativeCore", "NativeDesign", "NativeFeatures", "NativeMoreViews", "NativeViews", "AppDelegate", "SceneDelegate"];
const swift = Object.fromEntries(swiftFiles.map((name) => [name, read(`ios/App/App/${name}.swift`)]));
const allSwift = Object.values(swift).join("\n");

test("no student's course names are hardcoded, on the website or in the app", () => {
  assert.doesNotMatch(allSwift, /1154|1213|"Physics"|"Humanities"/);
  assert.doesNotMatch(read("src/lib/course-display.ts"), /RENAME_RULES|1154|1213/);
  assert.equal(displayCourseName("PHY 1154 University Physics", "PHY 1154"), "PHY 1154 University Physics");
  assert.equal(displayCourseCode("HUM 1213 Humanities Seminar", "HUM 1213"), "HUM 1213");
});

test("the app runs on iOS 17 and is packaged for the App Store", () => {
  const project = read("ios/App/App.xcodeproj/project.pbxproj");
  const targets = project.match(/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;/g) ?? [];
  assert.equal(targets.length, 4);
  for (const target of targets) assert.equal(target, "IPHONEOS_DEPLOYMENT_TARGET = 17.0;");
  assert.doesNotMatch(project, /capacitor|config\.xml|Main\.storyboard|debug\.xcconfig|COCOAPODS/i);
  assert.equal(existsSync(new URL("../ios/App/CapApp-SPM", import.meta.url)), false);

  const plist = read("ios/App/App/Info.plist");
  assert.match(plist, /<key>UIRequiredDeviceCapabilities<\/key>\s*<array>\s*<string>arm64<\/string>/);
  assert.doesNotMatch(plist, /armv7|CAPACITOR_DEBUG/);
  assert.match(plist, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  assert.match(plist, /<string>canvaspro<\/string>/);
  assert.match(swift.AppDelegate, /^@main$/m);
  assert.doesNotMatch(swift.AppDelegate, /@UIApplicationMain/);
});

test("text follows Dynamic Type everywhere", () => {
  // Fixed point sizes only appear inside the scaling helper and @ScaledMetric values.
  const fixed = allSwift.match(/\.font\(\.system\(size: (?!titleSize|subtitleSize|textSize|scaled)[^)]*\)\)/g) ?? [];
  assert.deepEqual(fixed, []);
  assert.match(swift.NativeDesign, /UIFontMetrics\(forTextStyle: style\)\.scaledValue/);
  // No text renders below 11 pt, Apple's smallest legible size.
  assert.match(swift.NativeDesign, /max\(11, size\)/);
  // Every text size is at least 11 pt; only SF Symbols use cpIconFont below that.
  for (const match of allSwift.matchAll(/\.cpFont\((\d+)[,)]/g)) assert.ok(Number(match[1]) >= 11, match[0]);
  assert.match(swift.NativeViews, /\.dynamicTypeSize\(\.\.\.DynamicTypeSize\.accessibility3\)/);
});

test("completion circles and reorder arrows are labelled for VoiceOver", () => {
  assert.match(swift.NativeViews, /accessibilityLabel\(isComplete \? "Mark \\\(assignment\.name\) as not done" : "Mark \\\(assignment\.name\) as done"\)/);
  assert.match(swift.NativeMoreViews, /accessibilityLabel\("Move \\\(item\.name\) earlier"\)/);
  assert.match(swift.NativeMoreViews, /accessibilityLabel\(NativeWeekday\.full\(day\)\)/);
});

test("a new account is guided to connect Canvas instead of seeing an error code", () => {
  assert.match(swift.NativeCore, /var isCanvasNotConnected: Bool/);
  assert.match(swift.NativeCore, /catch let error as NativeAppError where error\.isCanvasNotConnected/);
  for (const code of ["NO_CANVAS_KEY", "INVALID_DOMAIN", "CANVAS_DOMAIN_NOT_ALLOWED", "Canvas API 401"]) {
    assert.ok(swift.NativeCore.includes(`"${code}"`), code);
  }
  const screens = (swift.NativeViews + swift.NativeMoreViews).match(/NativeConnectCanvasCard\(store: store\)/g) ?? [];
  assert.ok(screens.length >= 5, "Dashboard, Assignments, Grades, Study and Get It Done");
  assert.match(swift.NativeMoreViews, /Text\("Connected"\)/);
  assert.match(swift.NativeMoreViews, /Text\(address\)\.cpFont\(12, design: \.monospaced\)/);
});

test("an expired sign-in returns to the sign-in screen", () => {
  assert.match(swift.NativeCore, /catch let error as NativeAppError where error\.isExpiredSignIn/);
  assert.match(swift.NativeCore, /if session\?\.refreshToken == originalToken \{ clearLocalSession\(\) \}/);
});

test("username sign-in and account deletion use the website's shared logic", () => {
  assert.match(swift.NativeCore, /appendingPathComponent\("api\/mobile\/sign-in"\)/);
  assert.match(swift.NativeCore, /appendingPathComponent\("api\/mobile\/delete-account"\)/);
  assert.doesNotMatch(swift.NativeCore, /functions\/v1\/delete-account/);
  const signIn = read("src/routes/api/mobile/sign-in.ts");
  const remove = read("src/routes/api/mobile/delete-account.ts");
  assert.match(signIn, /signInWithUsernamePassword/);
  assert.match(remove, /deleteAccountData/);
  assert.match(remove, /body\?\.confirm !== "DELETE"/);
  assert.match(remove, /supabaseAdmin\.auth\.getUser\(token\)/);
  assert.match(read("src/lib/account.functions.ts"), /deleteAccountData\(userId\)/);
  assert.match(read("src/lib/username-auth.functions.ts"), /signInWithUsernamePassword/);
  assert.equal(existsSync(new URL("../supabase/functions/delete-account", import.meta.url)), false);
});

test("one bad Canvas record never blanks the app, and duplicates never crash it", () => {
  assert.match(swift.NativeCore, /private struct LossyList<Element: Decodable>: Decodable/);
  assert.match(swift.NativeCore, /uniqueByID\(list\(\.assignments, AssignmentItem\.self\)\)/);
  assert.doesNotMatch(allSwift, /uniqueKeysWithValues/);
});

test("hidden classes are hidden on every screen", () => {
  assert.match(swift.NativeFeatures, /func shownAssignments\(in store: NativeContentStore\) -> \[AssignmentItem\]/);
  const uses = allSwift.match(/features\.shownAssignments\(in: store\)/g) ?? [];
  assert.ok(uses.length >= 5, `${uses.length} screens`);
  assert.doesNotMatch(allSwift, /store\.bundle\.assignments \+ features\.customAssignments/);
});

test("estimates, plans and the dashboard layout match the website", () => {
  assert.match(swift.NativeFeatures, /if let saved = estimates\[item\.id\], saved > 0 \{ return saved \}/);
  assert.doesNotMatch(swift.NativeMoreViews, /features\.estimates\[item\.id\] \?\? NativeParity\.defaultEstimate/);
  assert.match(swift.NativeFeatures, /bySettingHour: 12, minute: 0, second: 0/);
  assert.match(swift.NativeFeatures, /"announcements", "gpa", "heatmap"\]/);
  assert.match(swift.NativeFeatures, /queue\.popFirst\(\)/);
  assert.doesNotMatch(swift.NativeCore, /"CanvasProColorScheme", "CanvasProPalette"/);
});

test("Canvas HTML entities are decoded", () => {
  assert.match(swift.NativeViews, /var decodingHTMLEntities: String/);
  assert.match(swift.NativeViews, /"rsquo": "\\u\{2019\}"/);
  assert.match(swift.NativeViews, /UInt32\(entity\.dropFirst\(2\), radix: 16\)/);
});

test("Today's section switcher stays on the three Today pages", () => {
  const today = swift.NativeViews.slice(swift.NativeViews.indexOf("private struct NativeTodayView"), swift.NativeViews.indexOf("private struct NativeDigestSnapshot"));
  assert.match(today, /NavigationStack \{\s+Group \{/);
  const dashboard = swift.NativeViews.slice(swift.NativeViews.indexOf("private struct NativeDashboardView"), swift.NativeViews.indexOf("private var hero: some View"));
  assert.doesNotMatch(dashboard, /NavigationStack \{\s+ZStack/);
});

test("legal pages show the live policies, and links open the right tab", () => {
  assert.doesNotMatch(allSwift, /struct NativeLegalView/);
  assert.match(swift.NativeMoreViews, /SFSafariViewController\(url: url\)/);
  assert.match(swift.SceneDelegate, /NativeRouter\.shared\.open\(url\)/);
  assert.match(swift.NativeViews, /router\.takePendingPath\(\)/);
});

test("the syllabus is only on the class page, and Today uses the website's tabs", () => {
  const dashboard = swift.NativeViews.slice(swift.NativeViews.indexOf("private struct NativeDashboardView"), swift.NativeViews.indexOf("enum NativeGPA"));
  assert.doesNotMatch(dashboard, /syllabus/i);
  const course = swift.NativeViews.slice(swift.NativeViews.indexOf("struct CourseDetailView"), swift.NativeViews.indexOf("private struct CountUpGrade"));
  assert.match(course, /Label\("Syllabus", systemImage: "doc.text"\)/);
  for (const page of ["NativeDashboardView", "GetItDoneView", "FocusView"]) {
    const source = page === "NativeDashboardView" ? swift.NativeViews : swift.NativeMoreViews;
    const body = source.slice(source.indexOf(`struct ${page}`));
    assert.match(body, /NativeTodayTabs\(selection: \$(todaySection|section)\)/, page);
  }
  assert.match(swift.NativeDesign, /struct NativePageTabs/);
});

test("cards use hairline borders, no per-card shadows, and cached parsing", () => {
  // Card, row, tab and field outlines are 0.5 pt hairlines; checkboxes and selected
  // states are 1 pt so they stay visible. Nothing is thicker.
  assert.doesNotMatch(allSwift, /lineWidth: (1\.5|2|3)\)/);
  assert.doesNotMatch(allSwift, /RoundedRectangle\(cornerRadius: \d+\)\.stroke\(/);
  const surface = swift.NativeDesign.slice(swift.NativeDesign.indexOf("private struct CPSurfaceModifier"), swift.NativeDesign.indexOf("struct CPGlassCard"));
  assert.match(surface, /lineWidth: 0\.5/);
  assert.doesNotMatch(surface, /\.shadow\(/);
  // Due dates and Canvas HTML are parsed once, not on every redraw.
  assert.match(swift.NativeViews, /if let cached = NativeTextCache\.date\(for: value\) \{ return cached \}/);
  assert.match(swift.NativeViews, /if let cached = NativeTextCache\.html\(for: self\) \{ return cached \}/);
});

test("workload shows one readable week at a time, and the launch keeps clear space", () => {
  const workload = swift.NativeMoreViews.slice(swift.NativeMoreViews.indexOf("struct WorkloadView"), swift.NativeMoreViews.indexOf("struct AnnouncementsView"));
  assert.match(workload, /\["This week", "Next week", "Week 3", "Week 4"\]/);
  assert.match(workload, /ForEach\(shownDays, id: \\.self\)/);
  assert.doesNotMatch(workload, /0\.\.<28/);
  const launch = swift.NativeViews.slice(swift.NativeViews.indexOf("private struct NativeLaunchView"), swift.NativeViews.indexOf("private struct NativeAuthView"));
  assert.match(launch, /VStack\(spacing: 56\)/);
  assert.match(swift.NativeViews, /frame\(width: size \* 1\.1, height: size \* 1\.1\)/);
});

test("a new student is walked through connecting Canvas, once, and failures are explained", () => {
  // The welcome shows once per account, only for students who had no saved data.
  assert.match(swift.NativeViews, /struct NativeOnboardingView: View/);
  assert.ok(swift.NativeViews.includes('"CanvasProOnboarded.\\(sessionStore.session?.user.id ?? "")"'));
  assert.match(swift.NativeViews, /if hadSavedData == true \{ markOnboarded\(\); return \}/);
  assert.match(swift.NativeViews, /\.fullScreenCover\(isPresented: \$showOnboarding\)/);
  // Connecting is three steps with a paste button and a link to the student's own Canvas.
  const connect = swift.NativeMoreViews.slice(swift.NativeMoreViews.indexOf("struct CanvasSettingsView"), swift.NativeMoreViews.indexOf("struct ClassScheduleView"));
  for (const text of ["Your Canvas address", "Make an access token", "Paste your token", "PasteButton(payloadType: String.self)", "Open my Canvas settings"]) assert.ok(connect.includes(text), text);
  assert.match(connect, /\/profile\/settings/);
  // The first load shows placeholders, then data, a Connect step, or a retry card; never a false "no classes".
  assert.match(swift.NativeCore, /var isFirstLoad: Bool/);
  assert.match(swift.NativeCore, /loadFailure = errorMessage/);
  assert.match(swift.NativeMoreViews, /struct NativeLoadFailedCard: View/);
  const uses = (swift.NativeViews + swift.NativeMoreViews).match(/NativeLoadFailedCard\(store: store\)/g) ?? [];
  assert.ok(uses.length >= 4, `${uses.length} screens show the retry card`);
});

test("rows swipe, haptics are gentle, and accessibility has every action", () => {
  // Swipe right finishes or undoes, left starts a study session; both are VoiceOver actions too.
  assert.match(swift.NativeDesign, /private struct CPSwipeModifier: ViewModifier/);
  assert.match(swift.NativeDesign, /\.accessibilityActions \{/);
  assert.match(swift.NativeDesign, /abs\(horizontal\) > abs\(value\.translation\.height\) \* 1\.5/);
  assert.match(swift.NativeViews, /title: done \? "Undo" : "Done"/);
  assert.match(swift.NativeViews, /CPSwipeAction\(title: "Study", symbol: "timer"\)/);
  const swipes = (swift.NativeViews + swift.NativeMoreViews).match(/\.nativeAssignmentSwipe\(/g) ?? [];
  assert.ok(swipes.length >= 3, `${swipes.length} swipe rows`);
  // Haptics use the system's own feedback so they follow the phone's settings.
  assert.match(swift.NativeDesign, /\.sensoryFeedback\(\.selection, trigger: selection\)/);
  assert.match(swift.NativeViews, /\.sensoryFeedback\(trigger: running\)/);
  // Motion respects Reduce Motion.
  assert.match(swift.NativeDesign, /private struct CPRevealModifier/);
  assert.match(swift.NativeDesign, /opacity\(shown \|\| reduceMotion \? 1 : 0\)/);
  assert.match(swift.NativeViews, /\.contentTransition\(\.numericText\(\)\)/);
  // Large text: rows and tiles stack at accessibility sizes; outlines firm up with Increase Contrast.
  assert.match(swift.NativeDesign, /struct CPAdaptiveStack/);
  assert.match(swift.NativeDesign, /traits\.accessibilityContrast == \.high/);
  // The faintest text stays readable in light mode.
  assert.match(swift.NativeDesign, /: \.hsl\(palette\.hue, 0\.10, 0\.42\)/);
});

test("pages stay a readable width and the dashboard starts with the essentials", () => {
  // iPad and landscape: content is centred at a comfortable width instead of stretching edge to edge.
  assert.match(swift.NativeDesign, /static let maxContentWidth: CGFloat = 680/);
  assert.match(swift.NativeDesign, /\.frame\(maxWidth: CPLayout\.maxContentWidth\)/);
  // A new account sees five widgets; Customize brings the rest back.
  assert.match(swift.NativeFeatures, /\["focus", "calendar", "heatmap"\]/);
  // One path into the week view, not a duplicate button above the tiles.
  assert.doesNotMatch(swift.NativeViews, /Open focus view/);
});
