# 20 ideas to make CanvasPro better

Grouped by theme, all grounded in what's already built (widgets dashboard, push + countdown alerts, GPA calculator, grade snapshots, custom assignments, priority list, per-class pages, ICS export). None of these exist yet — pick any and I'll batch them.

## Understand your grades

1. **Grade history chart per class.** Grade snapshots are already recorded in the database but only shown as trend arrows. Add a small line chart on each class page showing how the grade moved over the semester.
2. **"What moves my grade" impact list.** On a class page, rank remaining assignments by how much each would raise or lower the final grade (points × category weight) — "the final is worth 30%: an A here puts you at 92%".
3. **GPA projection.** Extend the GPA calculator: enter expected grades for in-progress classes and see projected semester and cumulative GPA side by side.
4. **Grade-change alerts with letter steps.** Push a special alert when a letter grade flips (B+ → A−), not just when a score posts.

## Stay on top of work

5. **Canvas submission status.** Pull each assignment's submission state (submitted / graded / missing / unsubmitted) from Canvas and badge it everywhere assignments appear — the #1 thing a grades app can add beyond due dates.
6. **Canvas to-do items.** Canvas has items with no due date (readings, quizzes, unsubmitted work). Import the Canvas to-do feed so nothing invisible slips through.
7. **Notes on any assignment.** Personal notes currently only exist on custom assignments — extend them to Canvas assignments (persisted to the account like estimates are).
8. **Recurring custom assignments.** Weekly labs and discussion posts re-added by hand today; add a "repeats weekly" option.
9. **Suggested time budget.** Use the existing per-assignment time estimates to auto-suggest study blocks: "3h left on the lab — two 90-minute sessions before Thursday."
10. **Notification snooze & batching.** Snooze an alert for 1h / tonight / tomorrow; option to batch non-urgent alerts into one daily summary push instead of drip-feeding.

## Calendar & schedule depth

11. **Live subscribe calendar feed.** Today's ICS export is a one-time download. Serve a private, auto-updating calendar URL the phone's calendar app can subscribe to — new due dates appear without re-exporting.
12. **Google Calendar sync (one-way).** Push CanvasPro deadlines into a dedicated "CanvasPro" Google calendar via the existing Google sign-in.
13. **Finals mode.** Auto-detect the last two weeks of term and switch the dashboard to a finals view: exam schedule, per-class what-to-study, countdowns front and center.

## Trust, growth & first-run

14. **Try-the-demo mode on the landing page.** A "See a live demo" button loads the dashboard with realistic sample data — no signup — so visitors feel the product before paying.
15. **First-login guided tour.** Three-step spotlight tour (sync your key → customize widgets → set alerts) with a "skip" that's remembered per account.
16. **Referral program.** "Give a month, get a month" — referral links applied as Stripe coupons; a referral card in Settings.
17. **Weekly email digest.** Monday-morning email: what's due this week, grade changes, one announcement per class — using the existing email pipeline.

## Polish & infrastructure

18. **Accessibility pass.** Respect reduced-motion, audit contrast and focus rings, full screen-reader labels on widgets and the sidebar — also widens the audience.
19. **Status page / health indicator.** A tiny "Canvas sync: healthy / delayed" indicator plus a public status page; makes failures feel managed instead of mysterious.
20. **Study insights.** A small "Your month" card: assignments completed on time, busiest weekday, average time-per-assignment from your estimates — turns usage into motivation.

## Notes

- No new tables needed for 1–4 (grade_snapshots exists), 7–9 (user_preferences / user_assignment_meta), or 18–20.
- 5–6 need extra Canvas API reads in the canvas edge function; 10 and 17 touch the push/email pipeline; 11 needs a new public token-authorized ICS route; 12 uses the existing Google OAuth; 16 needs a Stripe coupon flow.
- Biggest user-value picks: 5, 1, 11, 14. Biggest business picks: 14, 16, 17.
