-- lovable-cron-fallback-reviewed: Canvas has no push webhook, so closed-app alerts need polling. 15-minute runs during waking hours (72 runs/day), one short request per account.
-- Closed-app push: send one dispatch request per account. The single shared
-- request from 0005 checks every account's Canvas in turn inside one hosting
-- request, which is cut off (request time and subrequest limits, and pg_net's
-- 55-second timeout) before later accounts are reached, so those students only
-- got alerts while the app was open. pg_net sends these requests in parallel and
-- each account gets its own time budget. The waking-hours window from 0005 stays.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'canvaspro-push-dispatch') THEN
    PERFORM cron.unschedule('canvaspro-push-dispatch');
  END IF;
END
$$;

SELECT cron.schedule(
  'canvaspro-push-dispatch',
  '*/15 10-23,0-3 * * *',
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
