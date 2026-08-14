# Where your data lives, and a security review

## Where each user's information is stored

**Cloud database (per-user, RLS protected)**
- `user_settings` — one row per user: `user_id`, `canvas_api_key`, timestamps.
- `class_nicknames` — one row per user per course: custom class names plus the raw Canvas name/code.
- Both tables have RLS enabled with four policies each (select/insert/update/delete), all scoped to `auth.uid() = user_id`, granted only to `authenticated` and `service_role`. No anonymous access. Verified: no publicly readable tables, database linter clean, security scan clean.

**Accounts** — email/password plus Google and Apple sign-in are handled by the managed auth service; passwords are never stored in app tables.

**Canvas data (grades, assignments, announcements, calendar)** — never stored. The `canvas` edge function reads the caller's own key from `user_settings` using the caller's own token (so RLS enforces ownership), calls Canvas live, and returns the result. It has `verify_jwt = true`, so unauthenticated calls are rejected.

**Browser localStorage (this device only)** — theme, dismissed announcements, completed assignments, notification history and preferences, reminder toggle, last-seen grade scores for trend arrows.

## Issues found

1. **localStorage is not scoped per account.** Keys like dismissed announcements, completed assignments, notification history and last-seen grades are global to the browser. If two people sign in on the same device, the second user inherits the first user's dismissed items, completed marks, grade snapshots and notification list. This is the only real cross-user leak in the app.
2. **Personal class schedule is gated by a hardcoded user id** in the class-schedule page. It works, but the personal timetable data is still shipped in the client bundle to everyone.
3. **The Canvas API key is stored as plain text** in the database. RLS keeps other users out, but the value is readable by anything with elevated database access.

## Proposed fixes

- Namespace every localStorage key with the signed-in user's id (e.g. `cp:<userId>:completed`), and clear/ignore un-namespaced legacy keys so nothing carries across accounts. On sign-out, drop the in-memory state so the next account starts clean.
- Move the personal class schedule data out of the shared bundle: keep the page, but only load the timetable after confirming the signed-in account owns it (or store it in a per-user table so anyone can define their own).
- Optional hardening for the Canvas key: keep it write-only from the UI (show a masked "key saved" state instead of returning the value to the browser), so the raw token is never sent back down after saving.

## Technical notes

- Files affected: `src/lib/local-state.ts`, `src/lib/local-value.ts`, `src/lib/notifications.ts`, `src/lib/notification-prefs.ts`, `src/hooks/use-notification-engine.ts`, `src/hooks/use-hourly-reminder.ts`, `src/routes/_authenticated/class-schedule.tsx`, `src/lib/user-settings.ts`.
- Approach: a small `useUserStorageKey()` helper that prefixes keys with the current user id; storage hooks accept the prefixed key rather than each call site building it.
- No database migration is required for the localStorage work. Making the Canvas key write-only is a client/query change only.
