# Friday Weekly Recap (alert + recap page)

## What students get
- **Every Friday at 4 PM (their local time)**: a phone/desktop alert, "Your week in CanvasPro: 3 graded, 2 announcements, 5 due next week". Tapping it opens the recap page.
- **New page: Weekly Recap** (`/recap`). It's also linked from the dashboard and the Notifications page, so students can open it any time.

## Recap page layout
Uses the same frosted glass cards as the homepage. There's a short header ("Week of Oct 6 – Oct 10"), then simple cards, each with a big number and a short list under it:
1. **Newly graded**: assignments graded in the last 7 days, with the score.
2. **Grade changes**: classes whose overall grade went up or down this week (old → new, with an arrow).
3. **New announcements**: posted in the last 7 days, grouped by class.
4. **Due in the next 7 days**: sorted by due date, showing points and saved progress %.
5. **Also worth knowing**: missing or overdue work, the busiest day next week, and how many assignments are already partly done.

**Canvas not connected**: every card keeps its title but shows no numbers or lists, and each card says "Connect your Canvas in Settings" with a button that opens Canvas connection settings. The Friday alert is skipped for these accounts.

## Settings
- A new "Weekly recap (Fridays)" switch in Notification settings, on by default, so students can turn it off.

## Technical details
- No new scheduled job. The existing 30-minute background check (`dispatch.ts`) queues one `weekly-recap-YYYY-MM-DD` row in `push_scheduled_alerts` when it's Friday and the user's local time (`notification_prefs.timezone_offset_minutes`) is at or past 4 PM. It doesn't queue one if the account has no Canvas key, the switch is off, or the recap was already sent this week (deduped through `push_sent_log`). The 5-minute scheduled run delivers it, and `scheduledAlertAllowed` gains the new tag. The counts in the alert come from the Canvas data that check already fetches.
- The recap page computes everything in the browser from the existing Canvas queries (assignments with `submission.graded_at`/score, announcements, courses) plus `grade_snapshots` for week-over-week grade changes. It reuses `assignment-workload` and `user_assignment_meta` for progress. A shared pure helper, `src/lib/weekly-recap.ts`, does the counting for both the page and the alert text, and has unit tests.
- The route is `src/routes/_authenticated/recap.tsx` with its own head() metadata. `canvas-key-gate` lets it through so the blank state with the "connect" prompt can show.
- Push safety: run `npm test` (background-push, outbound-policy, push-health, class-countdown plus the new recap tests). The heartbeat `reason` values stay the same. All Canvas requests keep going through `canvasRequestInit()`.
- No email is involved, and the app is not published.
