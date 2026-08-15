# Fix: elevated-permission helper flagged by the scanner

## What changes

The database helper `has_canvas_key` currently runs with owner-level
permissions (`SECURITY DEFINER`). It doesn't need them: it only checks the
signed-in user's own row, and the existing access rules already let that user
read exactly that row. Switching it to run with the caller's own permissions
removes the elevated privilege entirely, which clears the warning without
changing any app behaviour.

## Steps

1. Recreate `public.has_canvas_key()` as `SECURITY INVOKER` (same body, same
   yes/no return, pinned `search_path`).
2. Tighten who may call it: revoke execute from `public` and `anon`, grant
   execute to `authenticated` only.
3. Verify the Settings page still shows "key saved" and that pages still gate
   correctly when no key is saved.
4. Re-run the database linter and security scan to confirm the finding is gone,
   then mark it fixed.

## Technical notes

- The helper returns `EXISTS (select 1 from user_settings where user_id =
  auth.uid() and canvas_api_key is not null and length(btrim(...)) > 0)`.
  Under invoker rights, row-level security applies as the caller — who is
  already permitted to read their own `user_settings` row — so the result is
  identical.
- The Canvas token itself stays write-only from the browser: the function still
  returns only a boolean, never the key.
- No table, policy, or grant changes to `user_settings`; no frontend changes.
  `src/lib/user-settings.ts` keeps calling the same RPC.
