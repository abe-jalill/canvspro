# Fix "Next up" on the dashboard hero card

## Problem

The hero card's "Next up" section only looks at Canvas *calendar events* (`getCalendarEventsFn`, `type=event`). Assignment due dates are deliberately excluded from that calendar feed to avoid duplicates elsewhere, so when you have upcoming assignments but no calendar events, the card falls back to "Nothing scheduled in the next two weeks" — even though the summary line above it correctly counts assignments due this week.

## Fix

In `src/components/dashboard-hero.tsx`, build "Next up" from a merged list:

- Calendar events (as today), plus
- Upcoming assignment due dates from the assignments query, skipping ones that are completed locally or already submitted, plus
- Recurring class-schedule entries are out of scope for this change.

Pick whichever item comes soonest, and label it so its kind is clear (e.g. assignment name plus its class name, event title plus its context).

Also update the fallback text so it reflects reality: when there is genuinely nothing ahead, say "Nothing scheduled or due in the next two weeks."

## Technical notes

- Reuse the already-loaded `assignmentsQO` and `eventsQO` queries; no new data fetching, no backend change.
- Normalize both sources into a small `{ title, start, subtitle }` shape before sorting so the existing `untilLabel` / formatting code stays as-is.
- Respect the same exclusions the summary uses: `completed.has(a.id)` and `a.submission?.submitted_at`.
- Use `displayCourseName` for the class label, consistent with the rest of the app.
