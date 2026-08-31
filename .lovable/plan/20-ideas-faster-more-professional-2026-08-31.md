# 20 ideas: faster + more professional

Grouped by impact. Nothing here is built yet — pick the ones you want and I'll implement in batches.

## Tier 1 — biggest speed wins (recommend starting here)

1. **Persist the query cache to storage.** Cache Canvas data in the browser so a reload paints real content instantly instead of refetching, then refreshes in the background.
2. **One combined Canvas fetch.** Today courses, assignments, announcements and calendar are four separate calls. A single `resource: "all"` call returns everything in one round trip.
3. **Server-side cache with stale-while-revalidate.** The Canvas function currently caches in memory only (lost on cold start). Cache responses in the database per user so cold starts stay fast.
4. **Skeleton screens everywhere.** Replace spinners/blank panels with layout-matched skeletons so pages never jump.
5. **Optimistic UI on mutations.** Nicknames, schedule edits, widget layout and dismiss/complete apply instantly, roll back on error.

## Tier 2 — perceived polish

6. **Cmd+K command palette.** Jump to any page, class, or assignment; search across everything.
7. **Per-course accent colors.** Auto-assigned, consistent across dashboard, calendar, assignments, grades.
8. **Empty/error states with a real action.** Every blank panel gets an icon, one line, one button.
9. **Page transitions tuned.** Shorter, spring-based transitions; no flash on cached routes.
10. **Keyboard shortcuts + a `?` cheat-sheet.** g+d dashboard, g+a assignments, / to search.
11. **Offline mode.** Service worker serves the last-known data with an "offline — showing cached data" bar.
12. **Focus/hover/active states audit.** Visible focus rings, consistent glass hover, no layout shift on hover.

## Tier 3 — professional features

13. **Assignment detail drawer.** Click any assignment for description, rubric, points, submission status without leaving Canvas Pro.
14. **Grade "what-if" calculator per class.** Enter a hypothetical score and see the resulting course grade.
15. **Weekly email digest.** Monday-morning summary of the week's due dates using the existing email pipeline.
16. **Semester timeline view.** Horizontal view of the term with workload density — great screenshot for the landing page.
17. **Streaks / completion stats.** "12 assignments submitted on time this month" on the dashboard hero.
18. **Export & backup.** Download all data as JSON/CSV; export grades to PDF.

## Tier 4 — infrastructure credibility

19. **Real error boundaries per widget.** One failing widget shows a small retry card instead of blanking the dashboard.
20. **Performance budget + monitoring.** Track route load times and Canvas latency; surface slow syncs in a small status detail popover.

## Technical notes

- Items 1–3 are the actual latency fixes; the rest are perceived performance or product depth.
- Item 1: `@tanstack/query-persist-client` + `localStorage`, scoped by `user-scope.ts` so accounts don't share cache.
- Item 2 changes `supabase/functions/canvas/index.ts` to accept a batch resource and `src/lib/canvas.functions.ts` to fan out from one response; the four query keys stay the same.
- Item 3 needs a small `canvas_cache` table with RLS (user-owned rows) and GRANTs.
- Items 6, 8, 9, 12 are frontend-only.

## Suggested first batch

1, 2, 4, 5, 8 — that's the fastest load plus the biggest polish jump, with no new tables.