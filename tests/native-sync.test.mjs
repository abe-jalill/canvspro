import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// What a student sees, dismisses and chooses on the iPhone is saved to the
// account under the website's keys and in its format, so every device agrees.
const read = (name) => readFileSync(new URL(`../ios/App/App/${name}.swift`, import.meta.url), "utf8");
const views = read("NativeViews");
const more = read("NativeMoreViews");
const features = read("NativeFeatures");
const celebrations = read("NativeCelebrations");

test("Since your last visit is the account's record, the website's too", () => {
  assert.match(features, /guard let seen = decoded\("digest-seen", as: NativeDigestSeen\.self\)/);
  assert.match(features, /struct NativeDigestSeen: Codable, Equatable \{\s+var lastVisit: String\s+var grades: \[String: Double\]\s+var urgency: \[String: String\]/);
  // On screen five seconds counts as seen, saved for every device; this visit keeps its list.
  assert.match(views, /\.task\(id: store\.lastSyncedAt\) \{\s+try\? await Task\.sleep\(for: \.seconds\(5\)\)\s+guard !Task\.isCancelled, digest != nil, digestNeedsSave else \{ return \}\s+await features\.saveDigestSeen\(currentDigest\.seen\)/);
  assert.match(views, /if let seen = features\.digestSeen, let saved = NativeDigestSnapshot\(seen\) \{ digest = saved; return \}/);
  // The website's urgency rule, over the website's set of work.
  assert.match(views, /if days <= 0 \{ return "today" \}\s+return days <= 3 \? "soon" : "later"/);
  assert.match(views, /private var digestAssignments: \[AssignmentItem\] \{ store\.bundle\.assignments\.filter \{ !\$0\.notYetOpen\(\) \} \}/);
});

test("dismissed announcements are the account's list, shared with the website", () => {
  assert.doesNotMatch(views + more, /@AppStorage\("CanvasProDismissedAnnouncements"\)/);
  assert.match(features, /guard case \.some\(\.array\(let values\)\) = preferences\["dismissed-announcements"\]/);
  assert.match(features, /try\? await savePreference\("dismissed-announcements", ids\.sorted\(\)\.map\(String\.init\)\)/);
  assert.match(features, /await moveLocalDismissedAnnouncements\(\)/);
  // Restore brings back only what it would show, like the website.
  assert.match(more, /Restore \\\(restorable\.count\)/);
});

test("To-Do grouping, study setup and the streak celebration are the account's", () => {
  assert.match(features, /preferences\["todo-grouping"\], value == "class"/);
  assert.match(features, /decoded\("study-setup", as: NativeStudySetup\.self\)/);
  assert.match(views, /guard !Task\.isCancelled, setupApplied else \{ return \}\s+await features\.saveStudySetup\(currentStudySetup\)/);
  assert.match(celebrations, /let celebratedElsewhere = features\?\.streakCelebratedDay == fresh\.today/);
  assert.match(celebrations, /try\? await features\.savePreference\("streak-celebrated", fresh\.today\)/);
});
