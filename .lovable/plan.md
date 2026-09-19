# Switch CanvasPro to your own Stripe account

## Goal
Disconnect the current Lovable-managed Stripe account and accept payments through a new Stripe account you create yourself at stripe.com. The 2 existing subscribers keep their Pro access until their current paid period ends; no data migrates.

## What you do (2 manual steps)
1. **Disconnect the current Stripe** in the Payments dashboard (three-dots menu, top right). Existing subscribers keep billing on the old account until their period ends — nothing cancels automatically.
2. **Create your new account** at stripe.com, then paste its Secret key into the secure form I'll open. You'll also create a webhook in your Stripe dashboard pointing at the app's webhook address and paste its signing secret the same way.

## What I change in the app
- Remove the Lovable gateway Stripe code (`src/lib/stripe.server.ts` connection keys, sandbox/live environment split) and use the standard Stripe SDK with your own key everywhere: checkout, billing portal, webhook.
- Recreate the $2.99/month "pro_monthly" price in your new account and point checkout at it.
- Keep the entitlement logic exactly as hardened: Pro only from a server-verified subscription row owned by the signed-in account; fail closed.
- Update the webhook (`/api/public/payments/webhook`) to verify signatures with your new webhook secret and write subscription rows as before.
- Existing subscribers: their stored rows keep Pro active until `current_period_end`; the "Manage subscription" portal button only appears for subscriptions on the new account (old-account rows can't open a portal, so the button is hidden for them with a note).

## After it's wired
- You publish, then make one real test purchase on the live site to confirm money lands in your new Stripe account and Pro unlocks.

## Technical details
- BYOK Stripe integration via the secure key-entry modal; `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` stored as secrets, never in code or chat.
- New publishable key (`pk_live_...` from your account) replaces `VITE_PAYMENTS_CLIENT_TOKEN` — publishable keys are safe in code.
- `src/lib/stripe.ts`, `src/lib/subscription.ts`, `src/utils/payments.functions.ts`, `src/components/stripe-embedded-checkout.tsx`, `src/components/payment-test-mode-banner.tsx`, and the billing page lose the sandbox/live environment parameter (one account = one environment).
- Tax: with your own account, Stripe calculates and collects tax if you enable it; filing/remittance is yours. No managed-payments flag.
