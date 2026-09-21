# Per-user Canvas URL (school domain)

## Problem
The Canvas URL is currently one global value (`CANVAS_DOMAIN` = lawrencetech.instructure.com) used for every account. Students from any other school can't connect — they can enter an API key, but it's sent to the wrong school's Canvas and fails. A student must supply both their API key and their school's Canvas URL (e.g. `yourschool.instructure.com`).

## Changes

### 1. Database
- Migration: `ALTER TABLE public.user_settings ADD COLUMN canvas_domain TEXT` (nullable).
- No new grants needed (column on an existing, already-granted table; RLS unchanged).
- Existing users with no saved domain fall back to the global value, so current accounts keep working.

### 2. Settings screen (`src/routes/_authenticated/settings.tsx`)
- Add a "Canvas URL" input next to the API key, with helper text: "Your school's Canvas web address, e.g. `yourschool.instructure.com`".
- On save: trim, strip `https://`/`http://` and trailing `/`, keep only the hostname; reject empty/invalid hostnames (must look like a domain).
- Saving the URL and the key together in one "Save" action; clearing the key also clears the domain.
- On first setup, prefill the field with a placeholder, not a hard-coded school.

### 3. Key-save flow (`src/lib/user-settings.ts`)
- `useSaveCanvasKey` accepts `{ key, domain }` and upserts both columns; keeps the existing behavior of clearing the `canvas_key_status` flag on save.

### 4. Canvas proxy (`supabase/functions/canvas/index.ts`)
- `credsForRequest` reads the caller's `canvas_domain` from `user_settings` alongside `canvas_api_key` (same RLS-scoped REST query).
- Per-user domain when present; falls back to `CANVAS_DOMAIN` env when empty; error "NO_CANVAS_DOMAIN" if neither — client renders the setup state, not an error banner.

### 5. Push/alerts cron (`src/routes/api/public/push/dispatch.ts` + `src/lib/push-dispatch.server.ts`)
- `buildAlertsForUser` fetches the user's `canvas_domain` with their token and uses it per user; falls back to the global env var.

### 6. Client handling (`src/lib/canvas.functions.ts`, `src/lib/user-settings.ts`)
- Treat `NO_CANVAS_DOMAIN` like "no key yet" → empty states plus the setup card in Settings, no error banner.

### 7. Validation on save
- After saving key + domain, run one real check against `/api/v1/users/self` through the proxy with the saved credentials. If Canvas rejects it, show a clear message ("Canvas at that URL rejected the key — check both") so users can't save a silently broken pair.

## Verification
- Typecheck clean.
- Playwright against the preview: save key + `lawrencetech.instructure.com` → dashboard still loads with real data; save a wrong domain → clear error message, no crash; alerts cron still builds for the test account with the per-user domain.
- Confirm existing behavior for a user with no domain saved (global fallback) via a DB query.
