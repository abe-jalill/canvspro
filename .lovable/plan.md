# Canvas Pro — Ideas to Feel More Pro

## Goal
Identify 5–10 features that make Canvas Pro feel premium, increase daily utility, and justify the Pro tier. Each idea is scoped to a single, shippable feature and listed by impact vs. effort.

## Current strengths to build on
- Customizable dashboard with widgets and class nicknames.
- Live Canvas sync, grades, assignments, announcements, calendar, and class schedule.
- Focus windows, workload heatmap, notifications, and .ics export.
- Stripe Pro gating, notification preferences, and daily digest.
- Dark/light mode, mobile-first layout, and public marketing pages.

## Pro ideas

### 1. GPA & grade-goal calculator
**What:** A dedicated page or widget that computes current term GPA from Canvas course scores, lets the user set a target GPA, and shows what average is needed on remaining assignments to hit it.
**Why it feels Pro:** Students already track grades, but planning the path to an A is a different level of utility than viewing scores.
**Value:** Turns the app from a "reader" into a planner.
**Implementation:** Add a `public.grade_scales` table per user/course to store credit hours and letter-grade thresholds; derive GPA from existing `courses` data. Surface in `/grades` and as a dashboard widget.

### 2. Assignment prioritization score / smart to-do list
**What:** Replace the raw assignment list with a sorted "What to do next" view that ranks assignments by urgency, grade impact (if points are known), and user-defined priority.
**Why it feels Pro:** Feels like an AI assistant rather than a list.
**Value:** Reduces decision fatigue on what to tackle first.
**Implementation:** Compute a score from due date, overdue status, and `points_possible` relative to course total. Add a standalone `/priority` route and a dashboard widget.

### 3. Weekly prep email / push summary
**What:** A scheduled, opt-in Sunday evening summary email (and in-app notification) with: next week's assignments, any new grades, and unread announcements. Could be built as a daily/weekly digest option.
**Why it feels Pro:** Proactive, not reactive; feels like a personal assistant.
**Value:** Re-engages users without requiring them to open the app.
**Implementation:** Add a `notification_prefs` column for digest cadence. Use a TanStack server route under `/api/public/cron/digest` (called by pg_cron) and Lovable's email infrastructure to send to verified users.

### 4. Canvas file & module browser
**What:** A "Files" or "Modules" page that lists the latest uploaded files and module items from each Canvas course, searchable by class.
**Why it feels Pro:** Canvas's file navigation is notoriously slow; centralizing it is a clear upgrade.
**Value:** Saves time during exam prep and project weeks.
**Implementation:** Extend the Edge Function to fetch `/courses/:id/files` and `/modules` with `per_page=100`; add `/files` route and course filter. Cache aggressively because files change less frequently.

### 5. Grade-change history & mini charts
**What:** Store each course's current score whenever the app fetches grades, then show a small sparkline of the score over time per course and a list of recently changed assignment grades.
**Why it feels Pro:** Trend arrows are good; history and charts are better.
**Value:** Lets students see whether they are improving or slipping.
**Implementation:** Add a `public.grade_snapshots` table (user_id, course_id, score, timestamp) populated by a server function each sync. Use the existing `chart` component for sparklines.

### 6. Cross-device sync for dashboard layout & completed assignments
**What:** Persist dashboard widget order, dismissed announcements, completed assignments, and notification preferences to the database per user instead of browser localStorage.
**Why it feels Pro:** Users expect settings to follow them across phone, laptop, and tablet.
**Value:** Eliminates the "I marked this done on my phone and it's still here on my laptop" problem.
**Implementation:** Add a `public.user_preferences` table with RLS; replace `localStorage` writes with optimistic Supabase upserts, keep localStorage as a fast fallback/cache.

### 7. Assignment time estimates & study sessions
**What:** Let users optionally assign estimated minutes to each assignment, then show total weekly workload and suggest focused study sessions. Could be tied to the class schedule.
**Why it feels Pro:** Time management is a separate pain point from task tracking.
**Value:** Helps students plan realistic study blocks.
**Implementation:** Add `estimated_minutes` to a `user_assignments_meta` table; integrate with existing workload heatmap so color intensity reflects estimated time, not just assignment count.

### 8. Unread badge / announcement preview in navigation
**What:** Show live unread counts on the app sidebar for Announcements, Grades, and Assignments, and a subtle "new" dot on courses with unseen items.
**Why it feels Pro:** Common in premium apps; gives the navigation a sense of urgency.
**Value:** Users know where to look the moment they open the app.
**Implementation:** Compare last-seen timestamps stored in `user_preferences` against current data; render badges on `app-sidebar.tsx`.

### 9. Offline mode / read-only sync
**What:** Cache the last successful Canvas payload in IndexedDB so the app still shows the dashboard, grades, and assignments when the device is offline or Canvas is down.
**Why it feels Pro:** Feels like a native app, not a website.
**Value:** Reliable access during commutes or campus Wi-Fi dead zones.
**Implementation:** Use a TanStack Query `persistQueryClient` plugin with IndexedDB storage for `canvas.*` queries, plus a small offline banner.

### 10. Invite / referral program or group plan
**What:** A simple referral code system where Pro users can invite classmates; the referrer gets a free month when the invitee subscribes. Or a "Study group" shared dashboard view for project teams.
**Why it feels Pro:** Viral growth and collaboration features are hallmarks of mature products.
**Value:** Lowers the price barrier for students and creates network effects.
**Implementation:** Add a Stripe metadata coupon or a `referrals` table; for groups, allow read-only sharing of a filtered dashboard view.

## Recommended first 3 to implement
1. **GPA & grade-goal calculator** — highest student value, reuses existing grade data.
2. **Cross-device sync** — deeply Pro-feeling, improves every existing feature.
3. **Grade-change history & mini charts** — differentiator from Canvas's own gradebook.
