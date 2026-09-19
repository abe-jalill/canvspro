# Roadmap

- [x] Countdown alerts: next-class + tonight's deadline pushes, app-icon badge, settings controls
- [x] Reformat the Notifications page into clear, numbered sections
- [x] Notification bell panel overlaps/breaks layout on phones
- [x] Notification timestamps wrong (everything shows <22 hours ago)

## Security hardening pass

- [x] VAPID private key out of source, read from secrets
- [x] Email-based comped access removed; only paid account-owned records grant Pro
- [x] Payment webhook returns 400 on missing/invalid env
- [x] Validate checkout + portal return URLs server-side
- [x] Remove hardcoded EXCLUDED_COURSE_IDS; per-user hidden courses (Settings editor)
- [x] Restrict Canvas function CORS to app origins
- [x] Timing-safe cron secret comparison
- [x] Webhook: fall back to stripe_customer_id when subscription metadata has no userId
- [x] drizzle-orm stays a dev dependency (no runtime imports in src/)
- [x] Subscription query staleTime 30s -> 5min
- [x] Add .env / .env.* to .gitignore (values are publishable only; no rotation needed)

## Correctness pass: entitlements, cross-device sync, determinism

- [x] Identity layer (src/lib/auth-user.ts): storage scope + query cache keyed to the authenticated user id
- [x] Pro status fail-closed: per-user query key, session re-verified inside the fetch, never from cache/localStorage
- [x] Subscription + user-preferences + auth-user excluded from cache persistence (cache buster v2)
- [x] Authenticated gate clears any other account's cache before first render; sign-out purges scoped storage
- [x] Writes refuse to run until saved values have loaded (no empty-default overwrite of newer data)
- [x] Completion checkboxes disabled while the saved list loads
- [x] Stripe: never adopt another account's customer (deleted-account email reuse)
- [x] Webhook customer fallback scoped by environment
- [x] Fixed setState-during-render (live status + nickname lookup) causing random flicker
- [x] Verified: all user tables cascade-delete with the account; RLS on every table scoped to auth.uid()
- [x] Verified end-to-end: complete-assignment write lands in DB and shows on a second fresh browser; sign-out clears device state; protected routes redirect when signed out

## Paid access and billing portal incident

- [x] Remove email-based Pro bypass and make entitlement server-verified per user
- [x] Make Stripe portal opening resistant to popup blocking
- [x] Verify free-account lockout, paid-row isolation, and portal opening behavior

## Switch to a fresh Stripe account

- [x] User disconnects current Stripe in the Payments dashboard (three-dots menu)
- [x] Re-enable built-in Stripe (fresh Lovable-managed account)
- [x] Recreate Canvas Pro product at $2.99/month (pro_monthly, tax code set)
- [x] Verify checkout + portal on the new account after publish (verified in preview: test payment → webhook → Pro active → portal opens on billing.stripe.com; live payments still require go-live in the Payments tab)
