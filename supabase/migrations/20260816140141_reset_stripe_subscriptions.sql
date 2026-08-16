-- Reset old Stripe subscriptions after disconnecting the previous integration.
-- New subscriptions will be recreated by the new Stripe account's webhooks.
truncate table public.subscriptions;
