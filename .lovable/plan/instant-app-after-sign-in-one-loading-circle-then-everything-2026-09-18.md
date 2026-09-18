# Instant app after sign-in: one loading circle, then everything is ready

## What you'll see

Right after you sign in, the app shows a single centered loading circle (with a short line like "Getting your Canvas data ready"). Behind it, every page — Dashboard, Focus, Calendar, Class Schedule, Grades, Assignments, Announcements, Billing, Notifications, Settings — plus all the Canvas data those pages need loads at once.

When the warm-up finishes, the circle fades out and your dashboard appears. From then on, tapping any tab is instant because the page and its data are already in memory.

Safety valves so you're never stuck on the circle:
- If warm-up takes longer than about 8 seconds, the app goes ahead and shows the page anyway.
- If Canvas fails or is slow, the circle still clears and pages load with their own loading/retry states.
- The circle only appears once per sign-in, not on every navigation or refresh within the session.

## How it works

Background warm-up already exists in `src/hooks/use-app-prefetch.ts`; today it runs silently while the first page renders. The change is to make its completion something the layout can wait on and show while waiting.

1. `src/hooks/use-app-prefetch.ts`
   - Return a status (`warming` / `ready`) from the hook instead of nothing.
   - Keep the existing `Promise.allSettled` over all routes (`router.preloadRoute`) and the four shared Canvas queries (courses, assignments, calendar, announcements) so one failing section never blocks the rest.
   - Add the per-session "already warmed" flag in `sessionStorage`, keyed through `scopedKey()` from `src/lib/user-scope.ts`, so a page refresh in the same session skips the splash and a second account on the device never inherits it.
   - Add an ~8s cap that flips status to `ready` regardless.

2. New `src/components/app-warmup-splash.tsx`
   - Full-viewport glass overlay matching the app's existing style: centered spinning ring plus one muted line of text. No progress bar, no page chrome.

3. `src/routes/_authenticated/route.tsx`
   - Use the status from `useAppPrefetch(true)`; while `warming` and not previously warmed this session, render the splash instead of the sidebar/content tree, then swap to the normal layout with a short fade.
   - Everything below (`CanvasKeyGate`, `ClassNamesGate`, `ProGate`, `PullToRefresh`, `Outlet`) stays unchanged.

No backend, schema, or Canvas-fetch changes.
