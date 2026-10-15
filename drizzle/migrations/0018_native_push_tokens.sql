-- lovable-cron-fallback-reviewed: User asked for iPhone push (new grades and announcements) through Apple's push service. The existing canvaspro-push-dispatch job keeps its name, URL and 30-minute schedule; only its account list also includes students with a registered iPhone, still limited to accounts with access. No new job.
--
-- iPhone push: the device tokens the CoursePro iPhone app registers, so the
-- background check can send new grades and announcements through Apple's push
-- service (supabase/functions/apns). Due dates, class and tonight reminders and
-- the streak reminder are scheduled on the phone itself, so they aren't sent here.

CREATE TABLE IF NOT EXISTS public.native_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'ios' CHECK (platform = 'ios'),
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  failure_count integer NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Each student manages only their own phones' tokens; the server reads all.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.native_push_tokens TO authenticated;
GRANT ALL ON public.native_push_tokens TO service_role;
ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own native push tokens" ON public.native_push_tokens;
CREATE POLICY "own native push tokens" ON public.native_push_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS native_push_tokens_user_idx ON public.native_push_tokens (user_id);

-- The 30-minute check also visits students who only use the iPhone app.
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
    SELECT user_id FROM public.push_subscriptions
    UNION
    SELECT user_id FROM public.native_push_tokens
  ) AS accounts
  WHERE public.has_canvaspro_access(accounts.user_id);
  $$
);
