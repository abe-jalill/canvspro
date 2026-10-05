# Weighted Dashboard “Next Up” and realistic workload

## Goal
Make the dashboard prioritize what deserves attention, not only what is due first, while respecting each assignment’s saved completion percentage.

## Changes
- Replace the dashboard hero’s large seven-day count card with a “Next up” view that selects from unfinished assignments due in the next seven days.
- Rank candidates with a balanced score combining deadline urgency, point value, and remaining work. A close deadline still matters, but a high-value assignment with substantial work left can outrank a tiny task.
- Show the selected assignment’s name, due countdown, point value when Canvas provides one, and class name.
- When saved progress is high, show supportive context such as “Almost there — 75% done”; otherwise show the current percentage without implying the work is untouched.
- Keep the existing next-24-hours and overdue counts unchanged.
- Update the workload heatmap so each assignment contributes only its unfinished share. For example, an 80%-complete 100-point assignment contributes 20 remaining points.
- Keep assignment counts visible for clarity, while heat intensity and accessibility labels describe remaining workload rather than raw item count alone.

## Technical details
- Add a small shared, deterministic workload helper for remaining-work calculation and balanced “Next up” ranking.
- Use saved cross-device progress from `user_assignment_meta`; completed/submitted assignments remain excluded.
- For assignments without point values, use a neutral fallback weight so they still participate without overpowering known high-value work.
- Add focused tests covering point weighting, progress reduction, deadline urgency, completed work, and missing point values.
- No database change and no publishing.

## Verification
- Run the focused workload tests and project typecheck.
- Verify the dashboard at desktop and mobile widths, including long assignment names, missing point values, and 75% progress.
- Confirm the preview build remains healthy.
