# Onboarding plays once per account

Today the "already saw onboarding" flag is stored in the browser only, so the sequence can replay on a second device (e.g. it shows again on your phone after you've seen it on a computer), and it never runs if that browser's storage was already marked.

Goal: the welcome sequence plays exactly once — on the very first sign-in, whichever device that happens on — and never again for that account.

## What changes

- Store the "seen onboarding" state on the account instead of the browser, so desktop and mobile share one answer.
- On first dashboard load, check the account flag; if it hasn't been set, play the sequence and write the flag immediately when it starts.
- Skipping still counts as seen (no replay), and the whole flow keeps its current 3 steps, visuals, and mobile layout.
- If the account check hasn't returned yet, don't flash the overlay — wait for the answer, then decide.

## Technical notes

- Add a `seen_onboarding` boolean (default false) to `public.user_settings`, which is already per-user and RLS-scoped to `auth.uid()` with insert/update policies in place.
- `src/components/onboarding-overlay.tsx`: replace the `scopedKey("onboarding-seen")` localStorage read/write with a query + upsert against `user_settings` (via the browser Supabase client), keeping a localStorage mirror only as an instant-render optimization so a refresh mid-session doesn't re-trigger it.
- Mark seen at sequence start (not at the end) so a mid-sequence refresh or close doesn't replay it.
