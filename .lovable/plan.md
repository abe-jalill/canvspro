# Go live with real payments + include your Stripe payment link

## Part 1 — Your go-live steps (what YOU do, in order)

Your checklist is already 4 of 5 done: account claimed, live account set up, Lovable app installed, live keys created. What remains:

1. **Run the readiness check** — open the Payments tab, flip to **Live**, and click the readiness check. It verifies products, prices, and webhooks on your live account. Fix anything it flags (I can fix code issues for you).
2. **Publish the site** — the live site currently has no live checkout until you publish. Publishing also syncs the Canvas Pro $2.99/month product from test to live automatically.
3. **Make one real purchase on canvaspro.app** — sign in with a second email, subscribe with a real card, confirm Pro unlocks. Then refund yourself from your Stripe dashboard (Payments → the payment → Refund) so you're not charged.
4. **Verify a refund ends Pro** — after the refund, that test account should drop back to Free within a minute.
5. **Confirm your payout bank account is set** in your Stripe dashboard (Settings → Bank accounts) so money actually reaches you.

## Part 2 — Include the payment link (buy.stripe.com/5kQ4gBedp5be3Mn7yB3cc00)

The link you made is a shareable Stripe-hosted checkout page. One catch: unlike the in-app checkout, that page doesn't know which CanvasPro account is paying — Stripe only collects an email. Today, a purchase through it would charge the customer but **not unlock Pro**.

### What I'll build
- **Email-matching fallback in the webhook**: when a subscription arrives without a signed-in user attached, the app looks up the payer's email in your user accounts and links the subscription to that account. If they used the same email for CanvasPro and the payment, Pro unlocks automatically. If no account matches, the event is logged so you can see it and I can add a manual-grant tool later.
- **A "Share subscribe link" spot**: add the link to the Pricing page as a secondary option ("Or subscribe via shareable link") with a note that they must use the same email as their CanvasPro account. In-app checkout stays the primary button.
- **Cancel your own leftover test subscription** on the old flow (from my checkout test) — no charge ever occurred, but I'll clean the row.

### What YOU do for the link
- In your Stripe dashboard, open the payment link and confirm it sells the **Canvas Pro $2.99/month (pro_monthly)** price on your **live** account — not an old test product. If it's wrong, recreate the link against the live price and send me the new URL.
- Add one line to the link's confirmation page (Stripe lets you set a custom message): "Use the same email as your CanvasPro account — Pro unlocks automatically."

## Part 3 — Verify (I do this)
- Re-run checkout in preview (test mode) end-to-end.
- After you publish, verify live checkout renders on canvaspro.app/billing and the webhook receives live events.
- Simulate a payment-link-style subscription event (no user attached, email match) and confirm Pro unlocks.

## Technical details
- Webhook: `src/routes/api/public/payments/webhook.ts` — in `handleSubscriptionCreated`, when `metadata.userId` is absent, resolve the customer's email via Stripe, then match `auth.users` by email via the admin client and upsert the subscription row with that user_id. No match → console.error log (visible in the Payments/logs), no row written, fail closed.
- Payment link constant in `src/lib/stripe.ts` (`CANVAS_PRO_PAYMENT_LINK`), rendered on `src/routes/pricing.tsx` as a secondary link; opens in a new tab.
- Nothing about the hardened access rules changes: Pro still comes only from a server-verified paid record.
