import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Small things that were wrong on the iPhone, each kept right here.
const read = (path) => readFileSync(new URL(`../ios/App/${path}`, import.meta.url), "utf8");
const core = read("App/NativeCore.swift");
const views = read("App/NativeViews.swift");
const more = read("App/NativeMoreViews.swift");
const features = read("App/NativeFeatures.swift");
const design = read("App/NativeDesign.swift");
const celebrations = read("App/NativeCelebrations.swift");
const shared = read("Shared/CanvasProWidgetData.swift");

test("work Canvas hasn't opened yet is read from Canvas, and says when it opens", () => {
  assert.match(core, /unlockAt: \(try\? c\.decodeIfPresent\(String\.self, forKey: \.unlockAt\)\),\s+estimatedMinutes:/);
  assert.match(views, /struct NativeOpensLabel: View \{/);
  // On its own line, never squeezed into the pill row.
  assert.doesNotMatch(views, /CPPill\(text: opens, symbol: "lock"\)/);
  assert.match(more, /if !done \{ NativeOpensLabel\(assignment: item\) \}/);
});

test("signing out stops the last student's notifications and streak", () => {
  const signOut = core.slice(core.indexOf("private func clearLocalSession()"), core.indexOf("final class NativeContentStore"));
  assert.match(signOut, /NativeStreakReminders\.schedule\(nil, prefs: NotificationPreferences\(\)\)/);
  assert.match(signOut, /removePendingNotificationRequests\(withIdentifiers: \["canvaspro\.study\.block"\]\)/);
  assert.match(signOut, /removeAllDeliveredNotifications\(\)/);
  assert.match(signOut, /NativeStreakStore\.shared\.reset\(\)/);
  assert.match(core, /^import UserNotifications$/m);
  assert.match(celebrations, /func reset\(\) \{ streak = nil; celebration = nil; scope = "" \}/);
  // Ticks made on a widget can't be saved under the next account.
  assert.match(shared, /save\(\.signedOut\)\s+defaults\?\.removeObject\(forKey: pendingKey\)/);
});

test("this week is the circles' seven days on Today, Next up, To-Do and More", () => {
  assert.match(features, /static func isDueThisWeek\(_ item: AssignmentItem, now: Date = Date\(\)\) -> Bool \{\s+guard let due = item\.dueDate else \{ return false \}\s+return due >= now && due <= endOfUpcomingDay\(6, from: now\)/);
  assert.match(features, /guard isDueThisWeek\(item, now: now\) else \{ return false \}/);
  assert.match(views, /activeAssignments\.filter \{ NativeParity\.isDueThisWeek\(\$0\) \}/);
  assert.match(more, /allItems\.filter \{ NativeParity\.isDueThisWeek\(\$0\) && !\$0\.notYetOpen\(\) \}/);
  assert.match(more, /NativeParity\.isDueThisWeek\(\$0\) && \$0\.isVisible\(in: store\) && !\$0\.notYetOpen\(\)/);
  assert.doesNotMatch(views + more, /isInFocusWindow\(\$0, window: "7"\)/);
  assert.match(views, /"Nothing else due in the next seven days\."/);
});

test("study: real focus time, every task gets its time, and Today's chip never sits at 00:00", () => {
  assert.match(views, /private var currentFocusSeconds: Int \{ phase == "focus" \? max\(0, blockMinutes \* 60 - remaining\) : 0 \}/);
  assert.match(views, /focusedSeconds: focusedSeconds, timedOutIDs: Array\(timedOutIDs\)\)/);
  assert.match(views, /!completedIDs\.contains\(items\[next\]\.id\) && !timedOutIDs\.contains\(items\[next\]\.id\)/);
  assert.match(views, /if saved\.running && seconds == 0 \{ return NativeLivePomodoro\(label: "Time's up", time: "Time's up", timesUp: true\) \}/);
  assert.match(views, /time: CanvasProActivityFormat\.clock\(seconds\)\)/);
  assert.doesNotMatch(views, /%02d:%02d", seconds/);
  // "1 minute", not "1 minutes".
  assert.match(celebrations, /let span = minutes == 1 \? "1 minute" : "\\\(minutes\) minutes"/);
});

test("hidden classes hide their calendar events too", () => {
  assert.match(features, /func shownEvents\(in store: NativeContentStore\) -> \[CalendarEventItem\]/);
  assert.doesNotMatch(views + more, /store\.bundle\.calendar\.compactMap/);
  assert.doesNotMatch(more, /let next = store\.bundle\.calendar/);
});

test("announcements: read the rest of any long post; dismissed posts aren't new", () => {
  assert.match(more, /if message\.count > 140 \|\| message\.filter\(\\\.isNewline\)\.count >= 2 \{/);
  assert.match(more, /!dismissed\.contains\(\$0\.id\) && \$0\.isWithin\(weeks: 1\)/);
});

test("To-Do: your own undated tasks are listed, and two classes with one name stay apart", () => {
  assert.match(more, /var id: String \{ courseID\.map \{ "course-\\\(\$0\)" \} \?\? day\.map/);
  assert.match(more, /if item\.dueDate == nil \{\s+listed = item\.id < 0/);
});

test("names and button labels wrap instead of being cut off", () => {
  assert.match(design, /\.multilineTextAlignment\(\.center\)\s+\.fixedSize\(horizontal: false, vertical: true\)\s+\.padding\(\.horizontal, 16\)\s+\.padding\(\.vertical, 6\)/);
  const name = /Text\((item|assignment)\.name\)[^\n]*\.lineLimit\(/;
  assert.doesNotMatch(views, name);
  assert.doesNotMatch(more, name);
  assert.match(views, /To-Do lists your work day by day\./);
});
