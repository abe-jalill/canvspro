# 20 ideas to make CanvasPro better

Grouped by theme, all grounded in what's already built (widgets dashboard, push + countdown alerts, GPA calculator, grade snapshots, custom assignments, priority list, per-class pages, ICS export). None of these exist yet — pick any and I'll batch them.

## Understand your grades

1. **Grade history chart per class.** Grade snapshots are already recorded in the database but only shown as trend arrows. Add a small line chart on each class page showing how the grade moved over the semester.

## Stay on top of work

5. **Canvas submission status.** Pull each assignment's submission state (submitted / graded / missing / unsubmitted) from Canvas and badge it everywhere assignments appear — the #1 thing a grades app can add beyond due dates.
6. **Notes on any assignment.** Personal notes currently only exist on custom assignments — extend them to Canvas assignments (persisted to the account like estimates are).
7. **Suggested time budget.** Prompt users to optionally add a time slot. When they press on it, a timer from the right side will pop up, with the same 3 buttons as the sidebar. Shouldnt be that big, reasonable size.

## Calendar & schedule depth

11. **Google Calendar sync (one-way).** Push CanvasPro deadlines into a dedicated "CanvasPro" Google calendar via the existing Google sign-in

## Notes

- No new tables needed for 1–4 (grade_snapshots exists), 7–9 (user_preferences / user_assignment_meta), or 18–20.
- 5–6 need extra Canvas API reads in the canvas edge function; 10 and 17 touch the push/email pipeline; 11 needs a new public token-authorized ICS route; 12 uses the existing Google OAuth; 16 needs a Stripe coupon flow.
- Biggest user-value picks: 5, 1, 11, 14. Biggest business picks: 14, 16, 17.