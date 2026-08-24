# Minimalist dashboard hero card

## Problem

The hero card's "Next up" area currently spells out the full assignment/event title, date, and class on two lines. The user wants a more minimalistic summary that reads like "1 assignment due on X for Y class" and a single "See more" link that opens Focus.

## Plan

1. Simplify the "Next up" block in `src/components/dashboard-hero.tsx`.
   - Keep the existing `nextUp` data source (calendar events + assignments within the 1-week window).
   - Replace the two-line title/subtitle display with a single, compact sentence.
   - For the soonest assignment: "1 assignment due [time/day] for [display class name]".
   - For the soonest event: "1 event [time/day] for [display class name]".
   - Reuse the existing `untilLabel` helper and `displayCourseName` so the phrasing matches the rest of the app.
   - When nothing is upcoming, keep the fallback: "Nothing scheduled or due in the next week."

2. Repurpose the action link.
   - Change the "Open Focus" button text to "See more".
   - Keep it linking to `/focus`.
   - Ensure the arrow icon remains, sized for a clear call to action.

3. Tighten the layout.
   - Keep the greeting, date, and one-line summary at the top.
   - Make the divider between the summary and "Next up" thinner or more subtle if it improves the visual hierarchy.
   - Stack the "Next up" label, sentence, and "See more" link vertically on mobile, and switch to a horizontal alignment on larger screens.

4. Mobile formatting.
   - Ensure the sentence text truncates with `truncate` and does not overflow the card.
   - Keep the touch target for "See more" at least 44px tall.
   - Verify the card does not add horizontal scroll at small viewports.

## Implementation notes

- No new data fetching. Reuse `assignmentsQO`, `eventsQO`, `nextUp`, `summarize`, and `useLocalSet` exactly as they are.
- The change is purely presentational: restructure the JSX that renders when `next` is present.
- Keep the existing `greeting` and top summary line untouched.
