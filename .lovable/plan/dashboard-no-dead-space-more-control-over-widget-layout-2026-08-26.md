# Dashboard: no dead space, more control over widget layout

## The problem

The dashboard is a 2-column grid where every row is as tall as its tallest card. A short widget (GPA) next to a tall one (Classes & Grades) leaves a big empty block underneath, and full-width widgets force a hard row break.

## What changes

### 1. Gap-free packing

Widgets flow into a masonry-style layout: each card takes only the height it needs and the next card slides up into the space instead of waiting for the row to end. Full-width widgets still span the whole dashboard, but no longer leave empty rows around them.

- 1 column on phones, 2 on tablets, 3 on large desktops.
- Order is preserved top-to-bottom, left-to-right, so reordering still behaves predictably.

### 2. Per-widget size control

In Customize mode, each widget gets a size selector instead of a fixed built-in width:

- Small (1 column)
- Medium (2 columns, desktop only)
- Full (whole row)

Defaults match today's look, so nothing changes until you touch it. Size is saved with the layout, so it syncs across devices like order and visibility.

### 3. Better customize experience

- Drag to reorder works on the dashboard grid itself, not only inside the customize list — grab a card's handle and drop it where you want.
- Customize mode dims non-essential chrome and shows each card with a handle, size selector, and hide button in one row.
- "Reset layout" restores default order, sizes, and visibility.

### 4. Dashboard polish

- Consistent card headers: title left, "View all" link right, same padding and type scale everywhere.
- Tighter, more even spacing between cards; cards align to the top of their column so no card is stretched with blank filler.
- Compact widgets (GPA, Focus, Calendar) get a denser layout so they read as summaries rather than half-empty panels.
- Empty widgets collapse to a single quiet line instead of a tall empty card.
- Mobile: single column, full-bleed spacing, all controls at least 40px tall.

## Technical details

- `src/lib/dashboard-layout.ts`: extend stored layout with `sizes: Record<WidgetId, "sm" | "md" | "full">`, add `setSize`, keep `normalize` backward-compatible with layouts saved before this change (missing sizes fall back to the widget's default from `WIDGETS`).
- `src/components/widgets/dashboard-widgets.tsx`: replace `wide?: boolean` with `defaultSize`, and normalize each widget's internal header/empty state.
- `src/routes/_authenticated/dashboard.tsx`: swap the `md:grid-cols-2` grid for a column-based masonry container (CSS multi-column with `break-inside-avoid` for non-full widgets, full-width widgets rendered as their own full-bleed blocks between column runs) so short cards stack without gaps; add in-grid drag handles and the size selector in customize mode.
- No database or query changes; layout continues to persist through `user_preferences`.
