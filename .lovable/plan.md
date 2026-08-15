# Search growth: landing page, calculator, guide, and a widget dashboard

Four pieces of work: the three saved opportunities, plus turning the signed-in dashboard into a customizable widget home.

## 1. Public landing page at /

Today `/` is the signed-in dashboard, so a signed-out visitor is redirected to `/auth` and there is nothing for Google or a curious student to read.

- Move the dashboard to `/dashboard` and give `/` a real marketing page: what Canvas Pro does, the widget dashboard, grades / assignments / announcements / focus windows, $2.99 pricing, sign-up CTA, footer links.
- Signed-in users landing on `/` get sent to `/dashboard`, so nothing changes for you day to day.
- Same dark glass look as the rest of the app; mobile-first.

Confirm: this changes a public URL — the dashboard moves from `/` to `/dashboard`.

## 2. Free Canvas grade calculator at /canvas-grade-calculator

Public, no login. Semrush: ~5,400 searches/month, difficulty 30.

- Weighted grade calculator (category name, weight, your score) with a running total.
- "What do I need on the final?" calculator.
- Short explainer on how Canvas computes grades, weighting, and dropped scores.
- CTA: "Stop doing this by hand — Canvas Pro pulls your real grades in."

## 3. Guide page: customize your Canvas dashboard

Public guide covering the ~2,500/month cluster: showing grades on dashboard cards, renaming and hiding courses, removing old classes. Ends with how Canvas Pro does all of it automatically. One page as a pilot; expand only if it earns impressions.

## 4. Customizable widget dashboard

The dashboard becomes a grid of widgets, one per existing page:

- Class Calendar (today / this week's classes)
- Upcoming Assignments
- Grades
- Announcements
- Focus (due-soon countdown)
- Workload heatmap
- Daily digest

Controls:

- Show/hide each widget and drag to reorder.
- Layout saved per user in the browser, scoped to the account like other local state.
- Each widget has a "View all" link to its full page.
- Free tier keeps the dashboard shell and its upgrade prompts; Pro-only widgets show a small locked state instead of data, matching the current gating.

## Technical details

- New routes: `src/routes/index.tsx` (landing), `src/routes/canvas-grade-calculator.tsx`, `src/routes/canvas-dashboard-guide.tsx`, and `src/routes/_authenticated/dashboard.tsx` (moved from `_authenticated/index.tsx`).
- `/` redirects to `/dashboard` when a session exists; `_authenticated/index.tsx` is removed so the public index owns `/`.
- Update `FREE_PATHS` and `isFreePath` in `pro-gate.tsx` (`/dashboard` replaces `/`), sidebar `items`, and every `to="/"` link inside the app.
- Widgets extracted from the current 524-line dashboard into `src/components/widgets/*`; layout state in a new `src/lib/dashboard-layout.ts` using the existing user-scoped local storage helpers. Reordering with pointer-based drag, no new dependency unless needed.
- Per-route `head()` with unique title/description/og tags plus self-referencing canonical on each new public page; add the three URLs to `src/routes/sitemap[.]xml.ts`.
- No database or billing changes.
