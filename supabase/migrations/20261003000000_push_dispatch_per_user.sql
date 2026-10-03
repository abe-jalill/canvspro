-- Closed-app push: one dispatch request per account instead of one request for
-- everyone. A single shared request checks every account's Canvas in turn, so
-- as accounts are added it outlives pg_net's 55-second timeout and the hosting
-- request limits, and accounts late in the list are never reached. pg_net
-- sends these requests in parallel, and each gets its own time budget.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'canvaspro-push-dispatch') THEN
    PERFORM cron.unschedule('canvaspro-push-dispatch');
  END IF;
END
$$;

SELECT cron.schedule(
  'canvaspro-push-dispatch',
  '*/15 * * * *',
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
