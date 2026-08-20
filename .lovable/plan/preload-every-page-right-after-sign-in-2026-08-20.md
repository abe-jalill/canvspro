# Preload every page right after sign-in

Goal: once someone is signed in, all main pages (Focus, Assignments, Grades, Calendar, Announcements, Class Schedule, Settings, Notifications) are already warmed in the background, so tapping a nav item feels instant.

## Current state

- Canvas data is already shared and warmed once per session: the authenticated layout hydrates the last payloads from local storage and prefetches courses, assignments, announcements and calendar events. Every page reuses those same four cache entries, so the data side is already fast after the first load.
- What is NOT warmed is the page code itself. Route chunks only download when a link is hovered or tapped (`defaultPreload: "intent"`), so the very first visit to a page still waits on a JavaScript download before it can render.
- Two smaller data sets are also not warmed: the derived class meetings used by Class Schedule, and the saved class nicknames.

## What will change

1. After the layout mounts and the first data warm-up is scheduled, silently preload the code for every authenticated page — Dashboard, Focus, Assignments, Grades, Calendar, Announcements, Class Schedule, Notifications, Settings, Billing.
2. Warm the two missing data sets (class meetings, class nicknames) in the same background pass.
3. Run the preload politely so it never competes with the page the user is actually looking at:
   - starts only after the current page has painted (idle callback, with a timeout fallback)
   - preloads routes one after another, not all at once
   - skips entirely on a slow connection or data-saver mode
   - runs once per session; repeat navigations reuse what is already there
4. Keep hover/tap preloading as-is, so anything the background pass has not reached yet is still warmed on intent.

## Safety

- Preloading uses the router's own preload path, so failures are non-fatal: if a chunk or a request fails, nothing is thrown into the UI and the page still loads normally when clicked.
- Pages locked behind the Pro gate keep their gate; preloading only downloads code and public-to-the-user data, it does not bypass any check.
- No change to what is displayed, to gating, to auth, or to how data is fetched — only to when it is fetched.

## Technical notes

- New helper (e.g. `src/lib/preload-routes.ts`) exporting a `warmAuthenticatedApp(router, queryClient)` that: guards on `navigator.connection.saveData` / `effectiveType`, chains `router.preloadRoute({ to })` calls sequentially inside `requestIdleCallback`, and prefetches `classMeetingsQO` plus the nicknames query.
- Called from `src/routes/_authenticated/route.tsx` in the existing `useEffect`, after `prefetchAllCanvas`, guarded by a module-level `hasWarmed` flag and cleaned up on unmount via an abort flag so the chain stops if the user signs out.
- Add `classMeetingsQO` to `src/lib/canvas-queries.ts` so Class Schedule and the warm-up share one cache entry (same pattern as the existing query options).
