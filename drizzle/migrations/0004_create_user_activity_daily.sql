CREATE TABLE public.user_activity_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  interactions integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, activity_date)
);

GRANT SELECT, INSERT, UPDATE ON public.user_activity_daily TO authenticated;
GRANT ALL ON public.user_activity_daily TO service_role;

ALTER TABLE public.user_activity_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own activity" ON public.user_activity_daily
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX user_activity_daily_date_idx ON public.user_activity_daily (activity_date DESC);
CREATE INDEX user_activity_daily_last_seen_idx ON public.user_activity_daily (last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.record_activity_heartbeat()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  insert into public.user_activity_daily (user_id, activity_date, first_seen_at, last_seen_at, interactions)
  values (uid, (now() at time zone 'utc')::date, now(), now(), 1)
  on conflict (user_id, activity_date) do update
    set last_seen_at = now(),
        interactions = public.user_activity_daily.interactions + 1;

  return now();
end;
$$;

GRANT EXECUTE ON FUNCTION public.record_activity_heartbeat() TO authenticated;