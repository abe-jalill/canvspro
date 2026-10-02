# Native website refresh

Reference: local canvspro-full main at acf76ba (October 2, 2026).
Only SwiftUI files and native checks were changed; React source, authentication,
settings synchronization, and notification preferences were not modified.
Uncommitted website offline/service-worker changes are deliberately excluded.

## Implemented

- Study Session contains Get It Done and Study Session selectors. Calendar contains
  Calendar and My classes. The existing five Apple-native bottom tabs remain.
- Focus: next deadline, study shortcut, counts/points/estimated effort, seven local
  calendar days with drill-down, day/class grouping, completion and Undo.
- Study shortcuts seed the existing study setup without replacing an active session.
- Get It Done: recommendation first, actions and description link, then a quieter
  daily plan with existing skip, reorder, regenerate and estimate controls.
- Assignments: two-week agenda, optional weeks 3–4, later work searchable, shared
  Get It Done scorer, quiet priority labels, hidden undated zero-point placeholders.
- Dashboard: suppress zero-assignment class rows and summarize them; distinguish
  no new activity from urgent work still remaining.
- Class descriptions: enter the relevant class section, expand/scroll to the
  assignment, briefly highlight it, keep full assignment details reachable.
- Muted website grade colors and letter fallback; schedule uses class nicknames.

## Verification status

Node source regression tests pass. These are NOT Swift compilation or UI tests.
No Xcode/simulator is available on this Windows machine.

## Required native verification

Run Codemagic ios-workflow (Debug app artifact) and ios-release-check (Release).
Then check the following on small and large supported iPhones:

- Sign in, allow data to load, switch all five tabs; verify launch handoff.
- Switch Study sections while a timer runs; ensure timer/state remain intact.
- Use Focus Study shortcut with no active session, then with one already running.
- Switch Calendar/My classes, edit a meeting, check nicknames and return navigation.
- Focus: every date window, day/class grouping, empty week/day, completion and Undo.
- Assignments due at midnight, day 7/14/28 boundaries, undated tasks and search
  beyond four weeks; ensure completed and >24h overdue filtering is unchanged.
- Description links for normal, graded, completed, custom, and far-future work;
  confirm scroll/highlight and access to the full assignment details.
- Light/dark, all palettes, Reduce Motion, larger text, long course/assignment names.
- Slow network, cached data, failed loading, account sign-out/re-entry.

This checklist is pending device execution, not a claim of pixel-perfect parity.
