# Background notifications (works when the site is closed)

Today all alerts are generated in the browser: `use-notification-engine.ts` only runs while a CanvasPro tab is open, so closing the tab stops every reminder. To deliver alerts with the site closed, notifications must be created on the server and pushed to the device.

## What you'll get

- Allow notifications once, and your phone/laptop gets due-date, grade, and announcement alerts even with the browser closed.
- The same preferences you already set (which due windows, grade threshold, announcements, quiet hours) control the background alerts.
- Tapping an alert opens the right page in CanvasPro.
- Alerts stop duplicating: the server remembers what it already sent, and the bell menu stays in sync.

## How it works

1. **Installable app shell** — add a web app manifest and icons so CanvasPro can be added to a home screen. Required on iPhone: iOS only allows web push for apps added to the Home Screen. Desktop Chrome/Edge/Android work without installing.
2. **Service worker** — a small push worker that shows the notification and handles the click-through. Registered only in the published app, never in the Lovable preview/iframe.
3. **Push subscriptions** — new table storing each device's push endpoint and keys, scoped to the signed-in user with RLS. A settings toggle enables/disables background alerts per device.
4. **Preferences move to the backend** — notification preferences (currently browser-only) are mirrored to a table so the server can respect them. The existing settings UI keeps working; it writes to both.
5. **Scheduled server job** — a cron-driven endpoint under `/api/public/*` (bearer-authenticated) runs every 15 minutes: for each user with a saved Canvas key and an active subscription, it fetches assignments/announcements, applies that user's preferences and quiet hours, skips anything already sent, and delivers web push.
6. **Dedupe log** — a table of already-sent alert ids per user so a reminder fires once, not every run.

## Technical notes

- Push signing uses VAPID keys stored as project secrets; sending uses a Web Crypto-based web-push implementation (the common Node `web-push` package doesn't run in the edge runtime).
- The cron job reads Canvas keys with the privileged server client, since it acts outside any user session; the endpoint itself rejects any caller without the cron credential.
- Reuse the existing Canvas fetch logic and `notification-prefs` window/quiet-hours rules server-side so foreground and background alerts agree.
- The in-app bell keeps its current local behavior; background pushes also write a row so the bell shows them on next open.
- Service worker follows the PWA guardrails: no app-shell caching, no registration in dev/preview, `?sw=off` kill switch.

## Caveats

- iPhone/iPad: background push only after "Add to Home Screen" — the settings page will say so explicitly.
- Delivery granularity is the cron interval (~15 min), not to-the-second.
