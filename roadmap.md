# Roadmap

- [x] Countdown alerts: next-class + tonight's deadline pushes, app-icon badge, settings controls
- [x] Reformat the Notifications page into clear, numbered sections
- [x] Notification bell panel overlaps/breaks layout on phones
- [x] Notification timestamps wrong (everything shows <22 hours ago)

## Security hardening pass

- [x] VAPID private key out of source, read from secrets
- [x] Comped-Pro email list moved server-side (COMP_EMAILS secret)
- [x] Payment webhook returns 400 on missing/invalid env
- [ ] Validate checkout + portal return URLs server-side
- [x] Remove hardcoded EXCLUDED_COURSE_IDS; per-user hidden courses (Settings editor)
- [ ] Restrict Canvas function CORS to app origins
- [ ] Timing-safe cron secret comparison
- [ ] Webhook: fall back to stripe_customer_id when subscription metadata has no userId
- [x] drizzle-orm stays a dev dependency (no runtime imports in src/)
- [x] Subscription query staleTime 30s -> 5min
- [ ] Add .env / .env.* to .gitignore (values are publishable only; no rotation needed)
