# Subscription access endpoint — use the existing secure path

## Situation

The request asks for a new Edge Function `subscription-access` that reads the signed-in user's latest live subscription row and returns `status`, `price_id`, `current_period_end`, `cancel_at_period_end`.

Two constraints apply:

1. This stack (TanStack Start) does not support creating new Cloud Edge Functions — app-internal authenticated reads are implemented as server functions. Only the existing `canvas` Edge Function exists and it stays untouched, as requested.
2. The exact capability already exists and is wired in: `getSubscriptionAccess` in `src/lib/subscription.functions.ts`, called by `useSubscription()` and `fetchEntitlement()` in `src/lib/subscription.ts` (Pro gating, billing page).

## Verified: the existing implementation matches every stated requirement

- Runs only for the current user's authenticated session — it validates the request's bearer JWT server-side (`requireSupabaseAuth`) and double-checks the verified user id matches the token's user; it fails closed ("Not signed in") on any mismatch.
- Reads only that user's row: queries `subscriptions` filtered by the verified `user_id` and `environment = 'live'`, latest by `created_at`, single row.
- Returns exactly `status`, `price_id`, `current_period_end`, `cancel_at_period_end` (or `null` when none).
- No database creation, no migrations, no writes to any user data — it is a read-only SELECT under row-level security as the signed-in user.
- The `canvas` Edge Function is not modified.

## Work for this task

1. No new Edge Function, no new database objects, no data changes.
2. Re-verify the read path end to end against the live data: call it as the signed-in test account and confirm it returns only that account's latest live row with the four fields (and `null` for an account with no live subscription).
3. Confirm a signed-out / forged-user request is rejected (401 / fail-closed) and that no other account's rows are reachable.
4. Leave `src/lib/subscription.functions.ts` and `src/lib/subscription.ts` unchanged if verification passes; fix only if a check fails.

## Verification checklist

- Signed-in paid account: response carries that account's live subscription fields only.
- Signed-in free account: response is `null`, app shows Free.
- Unauthenticated call: rejected.
- `canvas` Edge Function and all migrations/data: untouched.
