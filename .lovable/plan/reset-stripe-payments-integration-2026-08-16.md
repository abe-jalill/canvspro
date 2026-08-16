# Reset Stripe Payments Integration

Goal: Remove the old built-in Stripe integration, enable a fresh Lovable built-in Stripe payments connection, and rewire the Canvas Pro subscription flow to use the new product/keys.

Assumptions from clarifying questions:
- Reconnect using **Lovable built-in Stripe payments** (not BYOK).
- Keep the same **$2.99/month Pro plan** and feature list.
- **Clear old subscription records** from `public.subscriptions` so no stale Pro access remains.

---

## Phase 1 — Verify provider fit
1. Run `payments--recommend_payment_provider` to confirm Stripe is eligible for a digital SaaS subscription.
2. Pause for user confirmation before enabling (enabling creates a managed Stripe account form and test environment immediately).

## Phase 2 — Remove the old integration
3. Delete old Stripe-only files that are now stale:
   - `src/lib/stripe.server.ts`
   - `src/lib/stripe-customers.server.ts`
   - `src/utils/payments.functions.ts`
   - `src/routes/api/public/payments/webhook.ts`
   - `src/components/stripe-embedded-checkout.tsx`
   - `src/components/payment-test-mode-banner.tsx`
4. Remove stale `.env` values:
   - `VITE_PAYMENTS_CLIENT_TOKEN` from `.env.development`
   - `VITE_PAYMENTS_CLIENT_TOKEN` from `.env.production`
5. Add a temporary safe state in the UI so the app does not crash while no client token exists:
   - `src/lib/stripe.ts`: return a clear "payments not configured" error.
   - `src/routes/_authenticated/billing.tsx`: show a "Payments are being reset — check back shortly" message instead of the checkout form.
   - `src/components/pro-gate.tsx`: keep free-only access until the new integration is live.
6. Clear the old subscription data: create a new migration that runs `TRUNCATE public.subscriptions;` (or delete rows with `environment` matching the old account). This ensures no user retains Pro access from the disconnected account.

## Phase 3 — Enable the new Stripe integration
7. Call `payments--enable_stripe_payments`.
8. After enabling, use the product-creation tools surfaced by the integration to create:
   - Product: **Canvas Pro**
   - Price: **$2.99/month recurring**
   - Lookup key: `pro_monthly` (or a new key if the integration generates one)
9. Record the new `VITE_PAYMENTS_CLIENT_TOKEN` and gateway/secret names provided by the integration.

## Phase 4 — Rebuild the checkout and webhook stack
10. Update environment variables:
    - Set new `VITE_PAYMENTS_CLIENT_TOKEN` in `.env.development` and `.env.production`.
    - Update `src/lib/stripe.ts` (`CANVAS_PRO_PRICE_ID`, `CANVAS_PRO_PRICE_LABEL`, and environment detection).
11. Recreate server-side code using the new built-in Stripe keys/gateway pattern:
    - `src/lib/stripe.server.ts` (gateway URL, client creation, webhook verification, error parsing).
    - `src/lib/stripe-customers.server.ts` (resolve or create customer by `userId`).
    - `src/utils/payments.functions.ts` (`createCheckoutSession`, `createPortalSession`).
    - `src/routes/api/public/payments/webhook.ts` (handle `customer.subscription.created`, `updated`, `deleted` and update `public.subscriptions`).
12. Recreate UI components:
    - `src/components/stripe-embedded-checkout.tsx`
    - `src/components/payment-test-mode-banner.tsx`
13. Reconnect consumers:
    - `src/lib/subscription.ts` (query `subscriptions` table, keep `COMP_EMAILS` comp list).
    - `src/routes/_authenticated/billing.tsx` (subscribe button + portal).
    - `src/routes/_authenticated/checkout.return.tsx` (post-checkout confirmation).
    - `src/routes/pricing.tsx` (checkout link).
    - `src/components/pro-gate.tsx` (unlock Pro routes on active subscription).

## Phase 5 — Validate
14. Build the project to catch type/import errors.
15. Run a sandbox test checkout from the billing page and confirm the webhook writes a new row to `public.subscriptions`.
16. Verify `useSubscription` returns `isActive: true` and Pro routes unlock.
17. Notify the user that live payments still require account verification/claim in the Lovable payments settings.

---

## Notes
- The old Stripe connection is already disconnected; the workspace no longer shows a Stripe connection, so there is no old connector to `disconnect` again.
- The Pro-gating free tier (dashboard only) remains intact while the reset is in progress.
- The comped email `ajalil@ltu.edu` will keep full Pro access throughout the reset.
- Any currently active paying users will need to resubscribe after the reset because the old Stripe account and customer records are gone.
