# Canvas Pro — 20 Ideas That Make It Feel Professional

## Goal
Deliver twenty concrete, shippable improvements that make Canvas Pro feel like a polished, production-grade product: fast, reliable, thoughtful, and slightly ahead of Canvas itself. Ideas are grouped by theme and each is scoped to a single feature or experience.

## Current state to build on
- Auth, Stripe Pro subscription, and comp-emails.
- Customizable dashboard with masonry layout, widget sizes, and cross-device sync.
- Live Canvas sync, GPA calculator, priority assignments, grade trends/snapshots.
- Class schedule editor with overlap warnings.
- Notifications center, focus view, workload heatmap, digest card.
- Public marketing pages: landing, grade calculator, dashboard guide.
- Mobile-first layout with collapsible sidebar and liquid-glass cards.

## Ideas

### 1. Command palette (Cmd+K / Ctrl+K)
**What:** A fuzzy-search modal that jumps to any page, class, assignment, or grade. Results ranked by recency and type.
**Why it feels Pro:** Power users expect instant navigation; it signals serious UX craft.
**Value:** Cuts clicks and mental load for heavy users.
**Implementation:** Add `src/components/command-palette.tsx`, index routes + nickname/courses/assignments on sign-in, bind `/` or Cmd+K globally.

### 2. Skeleton screens and shimmer states
**What:** Replace generic spinners with content-shaped skeletons on dashboard, grades, and assignments.
**Why it feels Pro:** Perceived performance is as important as real performance; skeletons make loading feel intentional.
**Value:** Reduces layout shift anxiety while Canvas data fetches.
**Implementation:** Create `src/components/skeletons/*.tsx` matching card shapes; use during initial queries.

### 3. Pull-to-refresh on mobile lists
**What:** On phone, pull down the assignments/announcements list to force a Canvas re-sync.
**Why it feels Pro:** Native-app behavior on the web.
**Value:** Gives users a sense of control over freshness.
**Implementation:** Add touch handlers or a lightweight library on authenticated list routes; call the sync function.

### 4. Smart error boundaries + recovery
**What:** Full-page error fallback with a “Retry sync” button and option to email the report. Toast on partial failures.
**Why it feels Pro:** Pros handle failure gracefully; amateurs crash silently.
**Value:** Builds trust when Canvas API flakes.
**Implementation:** Add `src/lib/error-capture.ts` integration, wrap authenticated routes with an error boundary component.

### 5. Toast confirmation system
**What:** Subtle slide-in toasts for “Schedule saved,” “Nickname updated,” “Sync complete.”
**Why it feels Pro:** Immediate, non-blocking feedback is a hallmark of polished apps.
**Value:** Removes doubt about whether an action worked.
**Implementation:** Wire `sonner` to a `useToast` hook; use it on mutations.

### 6. Keyboard shortcuts + shortcut cheat sheet
**What:** Press `?` to open a shortcuts panel. `g d` → Dashboard, `g a` → Assignments, `g c` → Calendar, `esc` → close modals.
**Why it feels Pro:** Small power-user touches add up to a “real app” impression.
**Value:** Speed for returning users.
**Implementation:** Add a global keydown listener and a `KeyboardShortcuts` modal.

### 7. Empty states that guide the user
**What:** Every zero-state card has an illustration-friendly UI, a sentence explaining why it is empty, and a CTA button (e.g., “Add your schedule,” “Sync now”).
**Why it feels Pro:** Empty screens are where cheap apps look cheapest.
**Value:** Converts first-time users and reduces support confusion.
**Implementation:** Standardize an `<EmptyState>` component used across dashboard widgets, grades, assignments, schedule.

### 8. Course color coding
**What:** Assign a unique color to each course; use it consistently in schedule, calendar, grade trends, and dashboard widgets.
**Why it feels Pro:** Visual identity at a glance.
**Value:** Faster scanning and personalization.
**Implementation:** Store `course_colors` in user_preferences; map to CSS variables or Tailwind color classes.

### 9. Assignment tags and filtering
**What:** Let users tag assignments (e.g., “Exam,” “Project,” “Reading”) and filter the assignments page by tag + due window + course.
**Why it feels Pro:** Organization beyond what Canvas provides.
**Value:** Helps students batch similar work.
**Implementation:** Add `tags` to `user_assignments_meta` table; extend assignments page filter bar.

### 10. Assignment sub-task checklist
**What:** Inside each assignment, add a personal checklist of steps with progress bar.
**Why it feels Pro:** Breaks intimidating work into manageable pieces.
**Value:** Increases completion rates on large projects.
**Implementation:** Add `sub_tasks` JSONB to `user_assignments_meta`; render in assignment cards.

### 11. Grade scenario simulator
**What:** On a course card, let the user enter hypothetical scores for upcoming assignments and see how the final grade changes.
**Why it feels Pro:** Turns stress into planning.
**Value:** Helps students prioritize effort by impact.
**Implementation:** Add a “What-if” mode to `GpaCalculator` or `/grades` row, using live assignment weights if available.

### 12. Exportable grade report (PDF)
**What:** One-click PDF export of current grades, GPA, and trends.
**Why it feels Pro:** Students need to share progress with advisors or parents.
**Value:** Tangible, shareable artifact.
**Implementation:** Use a Worker-safe PDF library (e.g., `@react-pdf/renderer` or pure JS) or generate from the client; add PDF button to `/grades`.

### 13. Attendance tracker
**What:** Simple per-class attendance log with excused/unexcused/absent options.
**Why it feels Pro:** Canvas does not track attendance well; this fills a gap.
**Value:** Helps users monitor participation policies.
**Implementation:** New `public.attendance_entries` table; small widget on dashboard and route under `/attendance`.

### 14. Study timer / Pomodoro tied to assignments
**What:** A focused timer users can start from an assignment; logs study minutes.
**Why it feels Pro:** Time management is a distinct pain point from task tracking.
**Value:** Encourages focused work and reveals time spent vs. estimates.
**Implementation:** Add `study_sessions` table; integrate with existing Focus view.

### 15. Canvas files & modules browser
**What:** A searchable Files page that pulls course files and modules through the Edge Function.
**Why it feels Pro:** Canvas file navigation is slow; centralizing it is a clear upgrade.
**Value:** Saves time during exam prep.
**Implementation:** Extend `supabase/functions/canvas/index.ts` to fetch `/courses/:id/files` and `/modules`; add `/files` route with class filter.

### 16. Offline-read dashboard
**What:** Cache last successful Canvas payload in IndexedDB; show data with an offline banner when connection drops.
**Why it feels Pro:** Behaves like a native app, not a website.
**Value:** Reliable access in campus dead zones.
**Implementation:** Use TanStack Query `persistQueryClient` for Canvas queries; add small offline indicator.

### 17. Onboarding checklist
**What:** A dismissible checklist for new users: connect Canvas API key, name classes, set schedule, enable notifications, try Focus view.
**Why it feels Pro:** Guides users to value quickly; reduces churn.
**Value:** Improves activation and first-week retention.
**Implementation:** Add `onboarding-progress` preference keys; render a top checklist until complete.

### 18. Referral / invite-a-classmate
**What:** Pro users get a referral code; when a classmate subscribes, the referrer gets a free month.
**Why it feels Pro:** Viral growth mechanics are a hallmark of mature products.
**Value:** Lowers price barrier and creates network effects.
**Implementation:** `public.referrals` table + Stripe coupon flow; route `/referrals` or modal in settings.

### 19. Accessibility pass
**What:** Audit keyboard focus, ARIA labels, color contrast, and screen-reader flows across all pages.
**Why it feels Pro:** Inclusive apps are professional apps.
**Value:** Meets university compliance standards and helps every user.
**Implementation:** Fix focus traps in modals, add skip links, ensure all interactive icons have labels, run axe checks.

### 20. PWA install prompt + app icon
**What:** Make Canvas Pro installable as a home-screen app with offline assets, a standalone manifest, and an install banner.
**Why it feels Pro:** Removes the “it is just a website” feeling.
**Value:** Higher engagement and a place on the home screen.
**Implementation:** Add `public/manifest.json`, service worker registration in `src/router.tsx`, install prompt component.

## Recommended first 5 to implement
1. **Skeleton screens + empty states** — highest surface-area polish for lowest effort.
2. **Command palette** — immediately signals a premium, fast tool.
3. **Toast system + error boundary recovery** — makes every other feature feel more reliable.
4. **Course color coding** — personalizes the whole app with one change.
5. **Grade scenario simulator** — differentiates Canvas Pro from Canvas itself.
