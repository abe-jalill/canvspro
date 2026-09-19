# Fix paid access and subscription management

## Goal
Ensure only a verified paid subscription belonging to the signed-in account unlocks Pro, and reliably open Stripe’s billing portal in a new tab.

## Changes
- Remove email-based complimentary access from the entitlement path. A user with no active subscription row will always be Free, including a deleted/recreated account using the same email.
- Move the entitlement lookup into an authenticated server function that verifies the current user, filters by that exact user ID and payment environment, and fails closed on every error.
- Keep all Pro UI locked while entitlement is unresolved; never use browser storage or persisted query data for paid access.
- Only show “Manage subscription” for a real paid subscription with a customer record. Complimentary or synthetic statuses will no longer exist.
- Open a blank tab immediately on the button press, then navigate that tab to Stripe after the portal session is created. Close it and show the exact error if Stripe cannot create the session, avoiding browser popup blocking.
- Validate that the Stripe customer referenced by the subscription belongs to the authenticated user before creating the portal session.

## Verification
- Confirm the newest account has no subscription row and renders as Free.
- Confirm paid accounts remain Pro and their subscription rows are isolated by user ID.
- Test Free and paid UI states in fresh browser contexts, account switching, and direct navigation to Pro pages.
- Test the portal button opens a separate tab and reaches Stripe for a paid account; verify failures close the placeholder tab and show an error.
- Run type checks and review database row-level access rules.
