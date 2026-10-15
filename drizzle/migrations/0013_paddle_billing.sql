-- lovable-cron-fallback-reviewed: User asked to make CanvasPro paid with a 14-day card trial through Paddle. Card-network rules require a reminder before a free trial first charges, and yearly renewals need advance notice; Paddle has no "trial ending" webhook timed for that, so an hourly job sends those emails. It makes no Canvas calls and posts once per run for all accounts. The push dispatch job keeps its name, URL and 30-minute schedule; only accounts with access are checked.
--
-- Paid CanvasPro: Paddle subscriptions with a 14-day card trial.
--
-- Nothing is blocked until billing_config.enforce_from is set (after Paddle
-- approves the domain). From that moment, accounts created earlier get 14 days
-- of free access; everyone else needs a trialing or paid Paddle subscription.
-- Access is decided here, in one function, for the website, the Canvas
-- function, closed-app push and (later) the iOS app.

-- One row: when the paywall starts. NULL = not yet.
CREATE TABLE IF NOT EXISTS public.billing_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enforce_from timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.billing_config (id, enforce_from) VALUES (true, NULL) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.billing_config TO anon, authenticated;
GRANT ALL ON public.billing_config TO service_role;
ALTER TABLE public.billing_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing config is public" ON public.billing_config;
CREATE POLICY "billing config is public" ON public.billing_config FOR SELECT USING (true);

-- One row per account. Written only by the Paddle webhook (service role), so
-- nobody can grant themselves access; each user can read their own row.
CREATE TABLE IF NOT EXISTS public.billing_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_customer_id text,
  paddle_subscription_id text UNIQUE,
  status text CHECK (status IN ('trialing', 'active', 'past_due', 'paused', 'canceled')),
  price_id text,
  plan text CHECK (plan IN ('monthly', 'yearly')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  -- A cancellation scheduled for the end of the paid period.
  cancel_at timestamptz,
  trial_used boolean NOT NULL DEFAULT false,
  -- Free access granted by the owner (the owner, testers, App Review).
  complimentary boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  -- Paddle's occurred_at of the last applied event; older events are ignored.
  last_event_at timestamptz,
  trial_reminder_sent_at timestamptz,
  -- The period end a renewal reminder was sent for.
  renewal_reminder_for timestamptz,
  grace_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_accounts_customer_idx ON public.billing_accounts (paddle_customer_id);
GRANT SELECT ON public.billing_accounts TO authenticated;
GRANT ALL ON public.billing_accounts TO service_role;
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own billing account" ON public.billing_accounts;
CREATE POLICY "own billing account" ON public.billing_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- The single access rule.
CREATE OR REPLACE FUNCTION public.has_canvaspro_access(user_uuid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH cfg AS (SELECT enforce_from FROM public.billing_config LIMIT 1)
  SELECT
    -- Paywall not started yet.
    coalesce((SELECT enforce_from IS NULL OR now() < enforce_from FROM cfg), true)
    -- Accounts from before launch: 14 days free from launch.
    OR EXISTS (
      SELECT 1 FROM auth.users u, cfg
      WHERE u.id = user_uuid
        AND u.created_at < cfg.enforce_from
        AND now() < cfg.enforce_from + interval '14 days'
    )
    -- Complimentary, a trial, a paid subscription, or a card Paddle is still retrying.
    OR EXISTS (
      SELECT 1 FROM public.billing_accounts b
      WHERE b.user_id = user_uuid
        AND (b.complimentary OR b.status IN ('trialing', 'active', 'past_due'))
    );
$$;
REVOKE ALL ON FUNCTION public.has_canvaspro_access(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_canvaspro_access(uuid) TO service_role;

-- What the signed-in account's billing looks like, for the website and app.
CREATE OR REPLACE FUNCTION public.my_billing_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH cfg AS (SELECT enforce_from FROM public.billing_config LIMIT 1),
  me AS (SELECT id, created_at FROM auth.users WHERE id = auth.uid())
  SELECT jsonb_build_object(
    'access', public.has_canvaspro_access(me.id),
    'now', now(),
    'enforce_from', cfg.enforce_from,
    'grace_ends_at', CASE WHEN me.created_at < cfg.enforce_from
                          THEN cfg.enforce_from + interval '14 days' END,
    'status', b.status,
    'plan', b.plan,
    'trial_ends_at', b.trial_ends_at,
    'current_period_end', b.current_period_end,
    'cancel_at', b.cancel_at,
    'trial_used', coalesce(b.trial_used, false),
    'complimentary', coalesce(b.complimentary, false),
    'has_subscription', b.paddle_subscription_id IS NOT NULL
  )
  FROM me CROSS JOIN cfg LEFT JOIN public.billing_accounts b ON b.user_id = me.id;
$$;
REVOKE ALL ON FUNCTION public.my_billing_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_billing_status() TO authenticated;

-- Closed-app push: only accounts with access. Same job name, URL and
-- 30-minute schedule as 0010_push_dispatch_every_30_minutes.sql; only the
-- account list changes.
SELECT cron.unschedule('canvaspro-push-dispatch')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'canvaspro-push-dispatch');

SELECT cron.schedule(
  'canvaspro-push-dispatch',
  '*/30 10-23,0-3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://canvaspro.app/api/public/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.push_cron_config LIMIT 1)
    ),
    body := jsonb_build_object('user_id', accounts.user_id),
    timeout_milliseconds := 55000
  )
  FROM (
    SELECT DISTINCT user_id FROM public.push_subscriptions
    WHERE public.has_canvaspro_access(user_id)
  ) AS accounts;
  $$
);

-- Trial-ending and renewal reminder emails, hourly.
SELECT cron.unschedule('canvaspro-billing-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'canvaspro-billing-reminders');

SELECT cron.schedule(
  'canvaspro-billing-reminders',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://canvaspro.app/api/public/billing/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.push_cron_config LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
