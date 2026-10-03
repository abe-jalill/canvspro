# Native website parity update

Reference: GitHub `main` at `8dc55ad` (October 3, 2026). The local
`canvspro-full` checkout was at `783443c`; the remote adds the "Coming Up"
Today label and a website preview auth storage fix. The iOS implementation
remains SwiftUI.

## Navigation

The five native bottom tabs are Today, Study Session, Grades, Assignments,
and More. Today contains Dashboard, Coming Up, and Get It Done. More contains
Calendar (Calendar and My classes), Announcements, Notifications, and Settings.
Profile stays inside Settings. Website admin Usage is a privileged route and
is not yet implemented as a native owner screen.

## Updated behavior

- Coming Up uses the website's compact summary, range menu, seven-day picker,
  day/class grouping, and finished toggle. Selecting a day filters the list.
- Get It Done shows a quiet suggestion and its remaining plan. Suggestion Start
  seeds Study Session; Canvas remains a separate link.
- Assignments is a global deadline-ordered agenda with a due-only priority
  list, two/four-week expansion, search for later work, and collapsed undated
  section. Students can add custom assignments.
- The shared recent window starts at local midnight three days ago. Completed
  work is shown only on request and only through four weeks ahead. Canvas work
  marked not done now saves a `reopenedAt` override to the same preference key
  as the website. A newer Canvas submission restores completion.
- Study Session has 25/5 and 50/10 Pomodoro presets, bounded custom focus/break
  lengths, automatic phase changes, skip break, and account-scoped saved state.
  The ordinary 1–480-minute timer remains available.
- Existing native cached coursework and account synchronization remain in place.
  Browser service-worker and preview auth storage changes have no native
  counterpart.

## Verification

Node source checks and the main branch's Pomodoro/reopen tests pass. Windows
cannot compile or run SwiftUI, so a Codemagic build and device inspection are
still required before calling the app visually or functionally verified.

On a Codemagic iOS build, check all five tabs on a small and large iPhone,
Today section transitions, Calendar in More, profile/settings access, light
and dark themes, and Reduce Motion. Exercise Pomodoro through a short break,
long break, pause/resume, app background/foreground, and skip break. Test
assignment search, the local day 3/7/14/28 boundaries, Canvas-submitted
reopen and resubmission, cached data, and account switching.

## October 2026 fix pass

`main` (at `20304ec`) is merged into `ios-native`, and every file outside the
iOS project now matches `main`. That removes the Stripe billing, pricing page,
paywall and Capacitor-era web code this branch had kept after `main` made
CanvasPro free. The SwiftUI app talks to Supabase directly and to two website
endpoints, so nothing else on the website is iOS-specific.

### Needs the website to be live with this branch

- `POST /api/mobile/sign-in` — username sign-in, using the same lookup as the
  website's sign-in form (`src/lib/username-auth.server.ts`).
- `POST /api/mobile/delete-account` — in-app account deletion (App Store
  guideline 5.1.1(v)), using the website's deletion
  (`src/lib/account-deletion.server.ts`). It replaces the
  `supabase/functions/delete-account` edge function, which was never deployed.

Both only exist once this branch is merged into `main` and published.

### What changed in the app

- New accounts see a Connect Canvas step on every coursework screen instead of
  a `NO_CANVAS_KEY` alert; server error codes are turned into plain sentences.
- A sign-in the server no longer accepts returns to the sign-in screen.
- Sign-in accepts an email or a username, like the website.
- The Canvas download is decoded record by record, so one unusual record is
  skipped rather than failing the whole sync; duplicate IDs can't crash lists.
- Hardcoded course renames ("PHY 1154" → "Physics", "HUM 1213" → "Humanities")
  are removed here and on the website. Only a student's own nicknames rename classes.
- Hidden classes are hidden on every screen (`NativeFeatureStore.shownAssignments`).
- Assignments summary counts no longer change with search or "Show completed".
- Unset time estimates use the default instead of showing 0 minutes.
- Get It Done: every Start opens a Study Session, and the reorder arrows move
  the rows shown.
- Study Session: the block counter never reads "0 of 4"; reordering works when
  a chosen task no longer exists.
- Canvas HTML entities (&#8217;, &rsquo;, …) are decoded.
- System appearance follows the iPhone's light/dark switch live.
- The Today switcher shows only on Dashboard, Coming Up and Get It Done.
- The dashboard layout keeps the website's GPA widget in place and uses the
  website's default order. Planned work goes on the calendar at noon on the
  due day, like the website. Signing out keeps the device's theme.
- A fresh install starts signed out (Keychain outlives deleting the app).
- The calendar can't page back to weeks that would always be empty.
- Canvas settings show which school is connected.
- Terms and Privacy open the live pages from canvaspro.app.
- All text follows Dynamic Type (nothing below 11 pt); fixed-size pieces
  (timer ring, week strips, day circles) are capped or shrink to fit.
- VoiceOver labels for the done circles, reorder arrows and day buttons.
- `canvaspro://…` links open the matching tab, including from a cold start.
- Project: iOS 17 minimum (was 26), `arm64` device capability (was `armv7`),
  export-compliance key, `@main`, and the unused Capacitor package, storyboard
  and xcconfig removed. Don't run `npx cap sync ios`; the app no longer uses
  Capacitor.
- Codemagic: a `ios-testflight` workflow builds a signed IPA and uploads it to
  TestFlight once the App Store Connect integration, signing and
  `APP_STORE_APPLE_ID` are set up (see the comments in `codemagic.yaml`).

### Still open (notifications, deferred on purpose)

- iPhone push: APNs sending (`src/lib/apns.server.ts`) isn't wired into the
  website dispatch, and the `native_push_tokens` table isn't in the live
  database, so registering a device fails.
- Tapping a notification while the app is fully closed loses its destination.
- Notification history marks everything "Scheduled".
- Study Session doesn't post a notification when a block ends in the background.
