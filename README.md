# CanvasPro

Here's the full, detailed prompt — copy this directly into Lovable:

Prompt for Lovable:

Build a personal student dashboard web app that pulls live data from the Canvas LMS REST API and displays my schedule, grades, assignments, and announcements.

Design — Apple "Liquid Glass" UI (this is the top priority for visual design)

This needs to genuinely feel like a native Apple interface, not a generic web dashboard with rounded corners slapped on. Specifically:

Frosted glass panels everywhere: every card/widget/sidebar should use translucent backgrounds with backdrop blur (like backdrop-filter: blur(20px) with a semi-transparent white/gray fill), so content behind it softly shows through

Layered depth: subtle drop shadows and soft borders (thin, ~1px, low-opacity white or gray) to give each panel a sense of floating above the background, like iOS/macOS Control Center or widgets

Monochrome palette only: black, white, and a full range of grays — no blue, no colored accents anywhere, including buttons, links, and status indicators (use grayscale weight/opacity to show emphasis instead of color)

Typography: clean sans-serif (SF Pro-style — use Inter or system-ui as the closest web equivalent), generous letter spacing, clear size hierarchy between headers and body text

Rounded corners on all cards/buttons (Apple-style continuous corner radius, ~16-24px)

Micro-interactions: smooth, subtle transitions on hover/click (fade, slight scale, no jarring movement) — like Apple's spring animations

Generous white space — don't cram widgets together; let panels breathe

Background: consider a very subtle gradient or blurred gradient blob background (like macOS Sonoma wallpapers) behind the glass panels so the blur effect actually has something to show through

Navigation

Left sidebar, frosted glass style, containing only simple text links (no extra widgets):

Dashboard

Schedule

Grades

Assignments

Announcements

Pages

1. Dashboard (home page) — overview with distinct glass-panel widget cards:

"Classes & Grades" widget (~25-35% of page width) — lists all active courses with current grade for each

"Upcoming Assignments" widget — everything due within the next 7 days

"Announcements" widget — recent course announcements across all classes

2. Schedule page — full calendar/agenda view of classes and events

3. Grades page — detailed breakdown per course, assignment-by-assignment where available

4. Assignments page — complete list of all assignments (not just upcoming), with due dates and submission status

5. Announcements page — full list of announcements across all courses

Data & API integration

Canvas domain: use environment variable CANVAS_DOMAIN (value: lawrencetech.instructure.com)

The Canvas proxy sends student tokens only to `*.instructure.com`, `CANVAS_DOMAIN`,
or school vanity hosts explicitly listed in the comma-separated
`CANVAS_ALLOWED_DOMAINS` Edge Function secret. Add a school's custom Canvas
hostname there before asking students to connect it. The proxy rejects
cross-host redirects.

Canvas API token: each user saves their own token in account settings. Never hardcode a token or expose another user's token in client-side code.

Fetch data on page load only — no polling, no auto-refresh timers

Only show active enrollments — filter out courses where access_restricted_by_date is true or workflow_state isn't available

Use these endpoints:

Courses: /api/v1/courses?enrollment_state=active

Assignments per course: /api/v1/courses/:id/assignments

Calendar events: /api/v1/calendar_events

Announcements: /api/v1/announcements?context_codes[]=course_:id

The server-side Canvas proxy sends each user's saved token as an Authorization: Bearer header.

Native iOS builds: Codemagic's `ios-workflow` is a Debug simulator build that
requires a real account and live Supabase data. Set `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` (or their `VITE_` equivalents) in Codemagic before
building. Before release, run `ios-release-check`; it compiles
the SwiftUI Release path, which uses real Supabase sign-in and requires
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Deploy the `canvas` and
`delete-account` Supabase Edge Functions before testing a live account.

Handle loading and error states gracefully — show a subtle glass-style loading skeleton while fetching, and a clean "couldn't load" message on failure instead of crashing

Security note

This app displays private academic data (grades). The Canvas token must be stored as a secret/environment variable, never committed to code, never rendered in the browser's dev tools or network tab if avoidable (route calls through a backend function if Lovable supports it, rather than calling Canvas directly from the client).

Build priority

Dashboard page with real Canvas data pulling correctly (courses + grades widget first)

Upcoming assignments widget

Announcements widget

Then build out the four sub-pages

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://canvspro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/affbea3f-cfe8-4941-aebb-24d8872c528c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
