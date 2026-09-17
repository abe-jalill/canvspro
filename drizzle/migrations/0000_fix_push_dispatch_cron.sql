-- lovable-cron-fallback-reviewed: 96 runs/day; Canvas has no push webhook, so due-date/grade alerts require polling within a 15-minute delivery window.
DO $$
BEGIN
  PERFORM cron.unschedule('canvaspro-push-dispatch');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'canvaspro-push-dispatch',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--affbea3f-cfe8-4941-aebb-24d8872c528c.lovable.app/api/public/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.push_cron_config LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);