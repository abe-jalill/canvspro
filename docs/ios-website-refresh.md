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
