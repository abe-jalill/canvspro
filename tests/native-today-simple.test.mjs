import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const views = read("NativeViews");
const more = read("NativeMoreViews");
const features = read("NativeFeatures");
const core = read("NativeCore");
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));

test("Today is short: a greeting, one line, Next up, and catch-up only when needed", () => {
  const hero = between(views, "private var hero: some View", "private var nextUpCard: some View");
  // No big card around the greeting and no stat tiles under Next up.
  assert.doesNotMatch(views, /heroSmallStat|heroBackground|heroStats/);
  assert.match(hero, /nextUpCard\s+if overdueCount > 0 \{ catchUpRow\.transition\(\.opacity\) \}/);
  // The greeting wraps for a long name instead of shrinking.
  assert.doesNotMatch(hero, /minimumScaleFactor/);
  // The quick Pomodoro is one small control beside the streak, not its own bar.
  assert.match(hero, /NativeStreakChip\(\)\s+NativeQuickPomodoro\(scope: store\.persistenceScope\)/);
  const body = between(views, "private struct NativeDashboardView", "private var shouldAskForWidgets");
  assert.doesNotMatch(body.slice(body.indexOf("var body: some View")), /NativeQuickPomodoro/);
  // The dashboard header is just when it updated and Customize.
  assert.doesNotMatch(views, /"Your dashboard"/);
  assert.match(views, /CPLinkLabel\(text: "Customize", symbol: "slider\.horizontal\.3"\)/);
  // One line on the week; past-due work has its own row.
  assert.match(views, /return "\\\(soon\) · \\\(week\) this week"/);
});

test("Get It Done and To-Do are one: Next up's Start replaces the Get It Done page", () => {
  assert.doesNotMatch(more, /struct GetItDoneView/);
  assert.doesNotMatch(features, /rankedAssignments|getItDoneScore|recommendationReason/);
  assert.match(views, /NativePageTabs\(selection: \$selection, options: \["Dashboard", "To-Do"\]/);
  // An old saved choice of Get It Done opens the dashboard.
  assert.match(views, /\["Dashboard", "To-Do"\]\.contains\(todayPage\) \? todayPage : "Dashboard"/);
});

test("Grades has New grades: what came in over the last 24 hours", () => {
  // Canvas's posted time is read when it's there (a grade can be posted after grading).
  assert.match(core, /case postedAt = "posted_at"/);
  assert.match(core, /var postedAt: String\? = nil/);
  // The later of graded and posted, so a regrade or late release counts as new.
  assert.match(views, /\[submission\.gradedAt, submission\.postedAt\]/);
  assert.match(views, /submission\.excused != true/);
  assert.match(features, /static func newGrades\(_ items: \[AssignmentItem\], now: Date = Date\(\)\) -> \[AssignmentItem\]/);
  assert.match(features, /now\.addingTimeInterval\(-86_400\)/);
  // The button sits under the average and opens its own page with a back button.
  const grades = between(views, "struct NativeGradesView", "struct NativeNewGradesView");
  assert.match(grades, /gradesHero\s+newGradesButton/);
  assert.match(grades, /NavigationLink \{ NativeNewGradesView\(store: store, features: features\) \}/);
  for (const text of ['"New grades"', '"Past 24 hours"']) assert.ok(grades.includes(text), text);
  const page = between(views, "struct NativeNewGradesView", "struct NativeScoreBadge");
  assert.match(page, /\.cpNavigationTitle\("New grades"\)/);
  assert.match(page, /NativeEmptyState\(title: "No new grades\.", symbol: "chart\.bar"\)/);
  assert.match(page, /CourseDetailView\(course: course, store: store, features: features, highlightAssignment: item\)/);
  // The review account has one recent grade to show.
  assert.match(core, /gradedAt: row\.id == newestGraded \? gradedRecently : row\.due/);
});

test("the tab bar holds two or three picks, and five tabs use short names", () => {
  assert.match(more, /Picker\("Fourth tab", selection: Binding<NativeTab\?>/);
  assert.match(more, /Text\("None"\)\.tag\(NativeTab\?\.none\)/);
  // The optional pick only offers pages not already in the bar.
  assert.match(more, /NativeTabBar\.choices\.filter \{ !middle\.prefix\(2\)\.contains\(\$0\) \}/);
  assert.match(views, /\.tabItem \{ Label\(tab\.tabLabel\(compact: list\.count > 4\), systemImage: tab\.symbol\) \}/);
  for (const short of ['case .study: return "Study"', 'case .announcements: return "Posts"', 'case .classes: return "Schedule"']) {
    assert.ok(views.includes(short), short);
  }
});

test("More and the tab bar preview never shrink or cut off their words", () => {
  const page = between(more, "struct NativeMoreView: View", "enum NativeSupportFAQ");
  assert.doesNotMatch(page, /minimumScaleFactor|lineLimit\(1\)/);
  const row = between(more, "struct NativeMenuRow: View", "struct NativeMenuGroup");
  assert.doesNotMatch(row, /lineLimit\(1\)/);
  // The profile card leads More with the same soft gradient as Today's Next up.
  assert.match(page, /\.background\(CPTheme\.accentCardGradient\(scheme\)/);
  assert.match(views, /\.background\(CPTheme\.accentCardGradient\(scheme\)/);
});
