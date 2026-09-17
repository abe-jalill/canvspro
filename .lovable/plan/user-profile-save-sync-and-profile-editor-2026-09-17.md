# User profile (save + sync) and profile editor

## Goal
Add a student profile — first name, last name, nickname, school, major, class year — that loads instantly from local storage and syncs to the account so it follows the user across devices. Add a Profile editor in Settings and use the profile in the dashboard greeting.

## Changes

### 1. New file `src/lib/user-profile.ts`
Create it with the provided code, with one adjustment to match the app's existing per-account storage pattern:
- The local storage key goes through `scopedKey()` from `src/lib/user-scope.ts` (base key `canvas_user_profile`) so a second account signing in on the same device never inherits the previous user's profile.
- Everything else stays as provided: `UserProfile` interface, `getLocalProfile`/`saveLocalProfile` for instant offline reads, `fetchUserProfile` merging auth metadata over local values, `useUserProfile` query, and `useSaveUserProfile` mutation that saves locally, writes to Supabase Auth `user_metadata` (including `full_name`), and shows success/error toasts.

### 2. Profile editor in `src/routes/_authenticated/settings.tsx`
- New `GlassCard` titled "Profile" placed first on the page (above the Canvas API key card).
- Fields: First name, Last name, Nickname, School, Major, Class of — same input styling as the existing API key field, glass buttons for Save.
- Pre-filled from `useUserProfile()`; Save calls `useSaveUserProfile()`.
- Class of accepts a free-text year (e.g. "2028").

### 3. Dashboard greeting in `src/components/dashboard-hero.tsx`
- Replace the current ad-hoc `supabase.auth.getUser()` name lookup with `useUserProfile()`.
- Greeting name resolution order: nickname → first name → full name → email prefix (current behavior as last resort).
- Remove the hardcoded "Abrahim Returns!" fallback; when no name is known, show "Welcome back!".
- The rest of the hero card (summary line, stat pills) is unchanged.

## Verification
- Typecheck passes.
- In the preview: Settings shows the Profile card; saving persists after reload; the dashboard greeting reflects the saved nickname/first name.
