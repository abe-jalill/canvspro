## Fix: Refresh expired Canvas access token

The edge function is working correctly — Canvas is returning `401 Expired access token` (expired 2026-07-18). The stored `CANVAS_TOKEN` secret just needs a new value.

### Steps
1. Open the secure secret form for `CANVAS_TOKEN` so you can paste a fresh Canvas access token.
2. Once saved, the `canvas` edge function immediately picks up the new value on its next invocation — no code changes, no redeploy.
3. Reload the dashboard to confirm courses, assignments, and announcements load.

### How to get a new token
In Canvas: **Account → Settings → Approved Integrations → + New Access Token**. Give it a purpose (e.g. "Lovable dashboard") and leave the expiry blank (or set it far in the future) so this doesn't recur.

### Notes
- No code files change.
- The old token stays overwritten; nothing else in the app is affected.