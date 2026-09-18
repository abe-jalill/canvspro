# Lock screen countdowns: what's possible

## Straight answer first

iOS Live Activities and the Dynamic Island are only available to apps built and
shipped through Apple's App Store with native code. A website — even one added to
the Home Screen — cannot put anything in the Dynamic Island or draw a live
lock-screen card. No workaround exists.

What CanvasPro *can* do on the web, and what this plan builds:

- A lock-screen notification that says "Physics starts in 15 min" or
  "2 assignments due tonight at 11:59 PM", delivered even when the app is closed.
- That notification quietly **updates in place** as time passes (30 min → 15 min →
  5 min → "starting now") instead of stacking up new alerts, so it behaves like a
  live countdown on Android and desktop.
- A **number badge on the app icon** showing how many items are due today, kept
  current in the background.

On iPhone the notification appears on the lock screen but Apple does not refresh
its text in place, so each countdown step arrives as its own alert — the plan
limits iPhone to a small set of steps so it never feels spammy.

## What gets built

**1. Countdown alert types (opt-in, in Notifications settings)**

- *Next class* — alerts at chosen lead times before a class starts, using the
  class schedule the user entered (day, time, location, professor).
- *Tonight's deadline* — a single evening alert summarising everything due before
  11:59 PM today, plus a final reminder at a chosen time.

Both default to off. Each has its own lead-time picker (e.g. 30/15/5 min for class,
6 PM/9 PM for deadlines), and both respect the existing quiet hours and daily
alert cap.

**2. Live-updating behaviour**

Countdown alerts reuse one notification slot per class/day, so an updated push
replaces the previous one rather than adding another. Android and desktop show a
single evolving alert; the last state stays on the lock screen.

**3. App icon badge**

While the app is open or the background worker runs, the icon shows the count of
things due today, and clears when nothing is left.

**4. Timing**

The existing background check runs every 15 minutes, which is too coarse for a
5-minute warning. Class alerts will be scheduled ahead: when the background check
runs it looks at the next few hours of the user's schedule and queues the exact
alert times, so a "5 minutes before" alert lands on time. The check interval itself
stays at 15 minutes, so no cost change.

## Settings screen additions

Under Notifications, a new "Countdowns" section:

- Next class reminders — toggle + lead times (30, 15, 5 min, at start)
- Tonight's deadlines — toggle + reminder time(s)
- App icon badge — toggle
- A short note that live lock-screen countdowns aren't possible on iPhone via the
  web, with the per-step behaviour explained

## Technical notes

- `notification_prefs.prefs` gains `countdowns: { nextClass, leadMinutes[], tonight,
  tonightTimes[], badge }`; defaults off so existing users are unaffected.
- New table `push_scheduled_alerts` (user_id, fire_at, tag, title, body, to, sent_at)
  with RLS + GRANTs; the dispatcher enqueues rows from `class_schedule_entries` and
  assignment due dates, then sends any row whose `fire_at` has passed. `tag` is
  stable per class-occurrence so pushes replace each other.
- `src/lib/push-dispatch.server.ts` gains the enqueue + drain steps, reusing the
  existing retry/backoff, quiet-hours and cap logic, and `push_sent_log` dedupe.
- `public/sw.js` push handler: `renotify: false`, keeps `tag`, and calls
  `navigator.setAppBadge` / `clearAppBadge` from a badge field on the payload.
- Client-side: a small hook sets the badge on load/refresh from cached Canvas data.
- Cron schedule, VAPID keys, and the dispatch route stay as they are.

## Still on you

Background delivery only works on the published site. After this ships: publish,
open canvaspro.app (iPhone: Add to Home Screen and open that icon), enable alerts,
then use Send test notification.
