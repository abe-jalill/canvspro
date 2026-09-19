# Switch CanvasPro to a fresh Stripe account (I set it up)

## Goal
Disconnect the current Stripe account and create a brand-new one through Lovable's built-in Stripe — I do the setup, you never sign up at stripe.com. The 2 existing subscribers keep Pro until their paid period ends; nothing cancels automatically and nothing migrates.

## How it works

1. **You disconnect the current Stripe** — Payments dashboard, three-dots menu (top right) → Disconnect. Only you can do this; it doesn't cancel anyone's subscription.
2. **I enable a fresh built-in Stripe account** — one click from me, no keys or signup forms. A new Stripe account is created for you behind the scenes.
3. **I recreate your product** — "Canvas Pro" at $2.99/month (same price id `pro_monthly`), so checkout, the billing page, and Pro access work exactly as they do now.
4. **You publish** and make one real test purchase to confirm money lands in the new account and Pro unlocks.

## Your questions, answered

### How do I access my Stripe dashboard?
Two ways:
- **Lovable's Payments dashboard** (in this project) — shows revenue, subscribers, and transactions without leaving Lovable.
- **Stripe's own dashboard** — when the new account is created, you'll get a claim/claim-link step (email from Stripe) that lets you set a password and log in at dashboard.stripe.com like any Stripe merchant. That's where you add your bank account for payouts.

### How do refunds work?
From your Stripe dashboard: Payments → click the payment → Refund. Full or partial, money returns to the customer's card in 5–10 days. The app hears about it automatically and ends Pro access at the right time — you don't touch any code. (You can also refund from the Lovable Payments dashboard.)

### How does tax filing work?
Because your account is US-based and Canvas Pro is a digital product, I'll turn on **full compliance handling** on checkout: Stripe calculates, collects, **files, and remits** sales tax/VAT for buyers in ~80 countries, and also covers fraud protection and dispute handling on those transactions. You don't file anything for those sales. Cost: +3.5% per transaction. For buyers outside those countries Stripe still calculates and collects the tax and warns you if you approach a filing threshold, but you'd file those yourself (rare at this scale). You can turn this off per transaction or entirely later.

## What changes in the code
Almost nothing visible — the current checkout, webhook, subscription table, and Pro-gating stay as they are (they were built for this provider). The main work is on the account side: disconnect, re-enable, recreate the product. While in there I'll also:
- Set the product's tax category (software subscription) so tax is calculated correctly.
- Keep the recently-hardened access rules exactly as they are: Pro only from a server-verified paid record owned by the signed-in account.
