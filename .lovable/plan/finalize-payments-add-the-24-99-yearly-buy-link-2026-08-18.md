# Finalize payments + add the $24.99 yearly buy link

## Where payments stand right now

Your Stripe setup is partly done:

1. Sandbox connected to a Stripe account — done
2. Complete the go-live form on Stripe — in progress (your action)
3. Install the Lovable app on your LIVE Stripe account — locked until step 2 is submitted (your action)
4. Live API keys — automatic, no action
5. Readiness check — runs after the rest

Until steps 2 and 3 are finished, checkout only works in test mode (test card 4242 4242 4242 4242). Real cards will not charge. Those steps happen on Stripe's side, from the Payments tab — I can't do them for you.

What you do:
- Open Payments, finish the Stripe activation form (business/personal details, bank account for payouts, two-step auth, review and submit).
- When Stripe offers "choose what to copy" to your live account, include the Lovable app and your products/prices.
- Come back and click the install-app step, then let the live keys provision (a couple of minutes) and run the readiness check.
- Publish the app after that so the live build ships with live keys.

## What I'll change in the app

Right now the yearly $24.99 plan exists in code and in the checkout plan selector, but no page links directly to it — the pricing page only has one "Buy now" that always starts monthly.

1. Pricing page: turn the single Pro card into two clear buy paths — "Buy monthly — $2.99/mo" and "Buy yearly — $24.99/yr (about 2 months free)" — each linking to `/checkout` with the matching plan. Keep the free card as-is.
2. Landing page CTA: add a secondary "or $24.99/year" link next to the main get-started button so the yearly option is reachable from the homepage.
3. Billing page: make the yearly option a visible choice for users who are already subscribed monthly (link into `/checkout?plan=pro_yearly`).
4. Checkout page: keep the existing plan toggle, and make the selected plan visually clearer plus show the yearly savings note.

## Technical notes

- Files touched: `src/routes/pricing.tsx`, `src/routes/index.tsx`, `src/routes/_authenticated/billing.tsx`, `src/routes/_authenticated/checkout.index.tsx`.
- No new price IDs: `pro_monthly` and `pro_yearly` already exist and resolve via Stripe lookup keys, so both work in sandbox today and carry over to live once go-live completes.
- No backend or webhook changes needed; subscription status handling already covers both intervals.
