CREATE TABLE public.push_scheduled_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag text NOT NULL,
  fire_at timestamptz NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  to_path text NOT NULL DEFAULT '/dashboard',
  badge integer,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag)
);

CREATE INDEX push_scheduled_alerts_pending_idx
  ON public.push_scheduled_alerts (fire_at)
  WHERE sent_at IS NULL;

GRANT SELECT ON public.push_scheduled_alerts TO authenticated;
GRANT ALL ON public.push_scheduled_alerts TO service_role;

ALTER TABLE public.push_scheduled_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own scheduled alerts"
  ON public.push_scheduled_alerts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
