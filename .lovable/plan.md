# Grade trend arrows: hover shows previous grade + fix stale type errors

## Part 1 — Fix the current build errors

The typecheck is failing because the generated database types (`src/integrations/supabase/types.ts`) are stale — they don't include the `account_profiles` table or the `set_username` / `username_available` / `set_avatar_path` functions that the profile code already uses.

Fix: regenerate the types from the live database (one command, no code changes). This clears all 16 errors in `account.functions.ts`, `user-profile.ts`, and `username-auth.functions.ts`.

## Part 2 — Grade trend arrow hover text

On the Grades tab, each class already shows an up/down arrow when its grade changes. This adds one thing: hovering the arrow shows "previously X%".

### Behavior (already in place, confirmed)

- A snapshot of each class's grade is saved only when the grade actually changes.
- The arrow compares the current grade to the last saved grade that differs, so it keeps pointing up or down until a new grade change happens — it does not reset on page revisit.
- A dash shows when the grade has never changed since tracking began.

### The edit

In `src/routes/_authenticated/grades.tsx`:

1. The `trends` memo currently stores only the direction. Extend it to also store the previous score it compared against.
2. Add a hover tooltip on the up/down arrow icons: `Previously 87.5%` (one decimal, matching the rest of the page).
3. The dash (no change) gets no tooltip.

## Technical details

- Files touched: regenerated `src/integrations/supabase/types.ts`; edited `src/routes/_authenticated/grades.tsx`.
- No new database reads — the previous score already comes from the existing `grade_snapshots` query.
- Native `title` attribute for the tooltip (no new components, minimal cost).
- Verify with typecheck after the edits.
