
# Plan: Three new dashboard features

All additions reuse the existing Liquid Glass design system (frosted panels, monochrome urgency, Inter/SF Pro, rounded corners, breathing hover). No new colors, no polling, no data model changes — everything piggybacks on the current `canvas` Edge Function.

---

## 1. Focus / Today view (new route `/focus`)

A dedicated page for the next 48 hours across all classes.

- New route file `src/routes/focus.tsx` and sidebar entry ("Focus") with a target icon.
- Data source: existing `getAllAssignmentsFn()` — no new fetch.
- Filter: assignments with `due_at` between now and now+48h, excluding completed + dismissed, applying the same exclusion + rename rules.
- Layout:
  - Top: two segmented chips "Next 24h" / "Next 48h" (reuses `Segmented`).
  - Grouped by class (same neat separation the user already asked for). Each group shows count and total points.
  - Each item is a checklist row: circular checkbox on the left → tapping marks it complete (writes to existing `COMPLETED_ASSIGNMENTS_KEY`), row fades and slides out with a short transition, then re-flows.
  - Empty state per class + a global "You're clear for the next 48 hours" state with a subtle glow when everything is done.
- Uses existing `getCountdown` for the label, existing urgency accent for the left border.

## 2. Workload heatmap (Schedule page)

Adds a 4-week glance grid above the existing week/semester list on `/schedule`.

- New component `src/components/workload-heatmap.tsx`.
- Builds a 4-row × 7-column grid starting from the current week's Monday.
- For each day, aggregates assignments (from cached `getAllAssignmentsFn`) whose `due_at` falls on that day, summing `points_possible` and counting items (excluded courses already filtered server-side).
- Cell intensity is a monochrome white/alpha ramp based on quartiles of that 28-day window — no red/yellow/green. Today gets a ring; days with 0 items stay at base glass.
- Hover / tap opens a small popover listing that day's items (title + class + points), reusing `glass-panel-strong`.
- Placed inside the existing Schedule segmented control area so it toggles with "Full Semester" (visible only on "This Week" and "Full Semester" both — decision: always visible at top of page, since it's a summary, not a mode).

## 3. Smart notifications digest (Dashboard)

A single pinned card at the top of `/` summarizing what changed since the last visit.

- New component `src/components/digest-card.tsx`, rendered as the first widget on the dashboard.
- Tracks "last seen" timestamp in localStorage (`canvas:last-visit`), updated when the digest is dismissed or when the user clicks into any linked item.
- Three sections, each collapsible if empty:
  - **New announcements** — items with `posted_at` after last-visit, grouped by class, showing title + class chip.
  - **New grades** — uses existing `LAST_SEEN_GRADES_KEY` map; any assignment whose score changed since last seen appears here with old → new score.
  - **Newly urgent** — assignments that flipped into "Due today" or "Due tomorrow" since last visit (compare cached prior countdown state stored in a new `canvas:last-countdown` map).
- If all three are empty, the whole card collapses to a one-line "All caught up." state with the breathing hover effect.
- "Mark all seen" button (top right) resets all trackers; individual item click also marks that item seen.
- No polling — data comes from the existing single fetch on page load.

---

## Technical notes

- New files:
  - `src/routes/focus.tsx`
  - `src/components/workload-heatmap.tsx`
  - `src/components/digest-card.tsx`
- Edits:
  - `src/components/app-sidebar.tsx` — add Focus link.
  - `src/routes/schedule.tsx` — mount heatmap above the existing list.
  - `src/routes/index.tsx` — mount digest as first widget.
  - `src/lib/local-value.ts` — add a small helper for a persisted string map to store prior countdown snapshots and last-visit timestamp (no new dependency).
- No changes to `supabase/functions/canvas/index.ts`, no schema changes, no new secrets.
- All existing rules preserved: excluded courses (11452, 3465, 6219) filtered server-side; display renames via `displayCourseName`; dismiss/complete persist in localStorage; monochrome urgency only.

