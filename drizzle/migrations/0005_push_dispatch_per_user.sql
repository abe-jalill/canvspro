-- Run the closed-app push dispatch once per hour during Eastern waking hours
-- (6 AM through midnight ET = 10:00-03:00 UTC during daylight saving),
-- 18 runs per day instead of every 15 minutes, to cut database hours.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'canvaspro-push-dispatch') THEN
    PERFORM cron.unschedule('canvaspro-push-dispatch');
  END IF;
END
$$;

SELECT cron.schedule(
  'canvaspro-push-dispatch',
  '0 10-23,0-3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://canvaspro.app/api/public/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.push_cron_config LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);