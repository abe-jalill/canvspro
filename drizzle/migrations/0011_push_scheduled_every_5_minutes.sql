-- lovable-cron-fallback-reviewed: User explicitly asked that class reminders arrive at the chosen lead time ("15 minutes before"). The 30-minute dispatch only reached queued reminders every half hour, so a 15-minute warning landed when class began. This job sends queued push_scheduled_alerts at their time; it makes no Canvas calls, posts once per run for all accounts, and only when a reminder is actually due, within the same 6 AM-midnight Eastern window.
SELECT cron.unschedule('canvaspro-push-scheduled')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'canvaspro-push-scheduled');

SELECT cron.schedule(
  'canvaspro-push-scheduled',
  '*/5 10-23,0-3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://canvaspro.app/api/public/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.push_cron_config LIMIT 1)
    ),
    body := jsonb_build_object('action', 'scheduled'),
    timeout_milliseconds := 30000
  )
  WHERE EXISTS (
    SELECT 1 FROM public.push_scheduled_alerts
    WHERE fire_at <= now() AND fire_at > now() - interval '6 minutes'
  );
  $$
);
