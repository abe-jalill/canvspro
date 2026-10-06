-- lovable-cron-fallback-reviewed: User explicitly requested the 30-minute cadence; dispatch is genuinely time-based reminder work on the approved 6 AM-midnight Eastern window.
-- Reschedules the closed-app push dispatch check to every 30 minutes
-- during Eastern waking hours (6 AM - midnight, i.e. 10:00-04:00 UTC),
-- keeping one separate dispatch request per account.
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
  FROM (SELECT DISTINCT user_id FROM public.push_subscriptions) AS accounts;
  $$
);