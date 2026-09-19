# Roadmap

- [x] Countdown alerts: next-class + tonight's deadline pushes, app-icon badge, settings controls
- [x] Reformat the Notifications page into clear, numbered sections
- [x] Notification bell panel overlaps/breaks layout on phones
- [x] Notification timestamps wrong (everything shows <22 hours ago)

## Security hardening pass

- [x] VAPID private key out of source, read from secrets
- [x] Comped-Pro email list moved server-side (COMP_EMAILS secret)
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
