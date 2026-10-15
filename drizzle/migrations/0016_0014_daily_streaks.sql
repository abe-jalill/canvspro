-- Daily streaks, like Duolingo: a day counts when the student opens CoursePro
-- (website or iPhone) on that calendar day in their own time zone. One streak
-- freeze a calendar month covers a single missed day on its own, the next time
-- they come back. The 6 PM "Don't break your streak!!!" reminder rides the
-- existing queued-reminder pipeline (push_scheduled_alerts); no new cron job.

CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  -- The student's own calendar date of their latest active day.
  last_active_on date,
  -- The missed day the most recent freeze covered (one per calendar month).
  freeze_used_on date,
  -- Newest first, for the week strip: active days (60) and frozen days (12).
  recent_days date[] NOT NULL DEFAULT '{}',
  frozen_days date[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Written only by record_streak_activity() below, so nobody can edit a streak.
GRANT SELECT ON public.user_streaks TO authenticated;
GRANT ALL ON public.user_streaks TO service_role;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their own streak" ON public.user_streaks;
CREATE POLICY "Users read their own streak" ON public.user_streaks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Counts today (the caller's local date) toward the signed-in student's streak
-- and returns the streak for the app to show. Safe to call on every open: only
-- the first call of a day changes anything (`extended`).
CREATE OR REPLACE FUNCTION public.record_streak_activity(p_today date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  uid uuid := auth.uid();
  utc_today date := (now() at time zone 'utc')::date;
  s public.user_streaks%rowtype;
  previous integer;
  froze date := null;
  lost integer := 0;
  extended boolean := false;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  -- Every time zone's date is within a day of UTC's (UTC-12 to UTC+14).
  if p_today is null or p_today < utc_today - 1 or p_today > utc_today + 1 then
    raise exception 'Invalid date' using errcode = '22023';
  end if;

  insert into public.user_streaks (user_id) values (uid) on conflict (user_id) do nothing;
  select * into s from public.user_streaks where user_id = uid for update;
  previous := s.current_streak;

  -- A date at or before the last active day (already counted, or flying west
  -- past midnight) changes nothing.
  if s.last_active_on is null or p_today > s.last_active_on then
    if s.last_active_on = p_today - 1 then
      s.current_streak := s.current_streak + 1;
    elsif s.last_active_on = p_today - 2
      and s.current_streak > 0
      and (s.freeze_used_on is null
        or date_trunc('month', s.freeze_used_on) <> date_trunc('month', p_today - 1)) then
      -- Missed exactly one day and that month's freeze is unused: it covers it.
      froze := p_today - 1;
      s.freeze_used_on := froze;
      s.frozen_days := (array[froze] || s.frozen_days)[1:12];
      s.current_streak := s.current_streak + 1;
    else
      lost := s.current_streak;
      s.current_streak := 1;
    end if;
    extended := true;
    s.last_active_on := p_today;
    s.recent_days := (array[p_today] || s.recent_days)[1:60];
    s.longest_streak := greatest(s.longest_streak, s.current_streak);

    update public.user_streaks
    set current_streak = s.current_streak,
        longest_streak = s.longest_streak,
        last_active_on = s.last_active_on,
        freeze_used_on = s.freeze_used_on,
        recent_days = s.recent_days,
        frozen_days = s.frozen_days,
        updated_at = now()
    where user_id = uid;

    -- Today's 6 PM reminder, if one was queued, is no longer needed. Marking
    -- it handled (not deleting it) keeps the push health check quiet.
    update public.push_scheduled_alerts
    set sent_at = now()
    where user_id = uid
      and tag like 'streak:' || p_today::text || ':%'
      and sent_at is null;
  end if;

  return jsonb_build_object(
    'current', s.current_streak,
    'longest', s.longest_streak,
    'previous', previous,
    'extended', extended,
    'froze', froze,
    'lost', lost,
    'today', p_today,
    'last_active_on', s.last_active_on,
    'freeze_used_on', s.freeze_used_on,
    'freeze_available', s.freeze_used_on is null
      or date_trunc('month', s.freeze_used_on) <> date_trunc('month', p_today),
    'recent_days', to_jsonb(s.recent_days),
    'frozen_days', to_jsonb(s.frozen_days)
  );
end;
$$;

REVOKE ALL ON FUNCTION public.record_streak_activity(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_streak_activity(date) TO authenticated;
