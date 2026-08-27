CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  failure_count integer NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);

CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone_offset_minutes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification prefs" ON public.notification_prefs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.push_sent_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, alert_id)
);
GRANT SELECT ON public.push_sent_log TO authenticated;
GRANT ALL ON public.push_sent_log TO service_role;
ALTER TABLE public.push_sent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sent log" ON public.push_sent_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.push_cron_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  secret text NOT NULL
);
GRANT ALL ON public.push_cron_config TO service_role;
ALTER TABLE public.push_cron_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.push_cron_config (id, secret)
VALUES (true, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

SELECT cron.schedule(
  'canvaspro-push-dispatch',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vqmzhzvugzhmtprklzfm.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.push_cron_config LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);