CREATE TABLE public.class_schedule_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  code TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  crn TEXT NOT NULL DEFAULT '',
  credits NUMERIC NOT NULL DEFAULT 0,
  instructor TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  campus TEXT NOT NULL DEFAULT '',
  schedule_type TEXT NOT NULL DEFAULT 'Lecture',
  days TEXT[] NOT NULL DEFAULT '{}',
  start_minutes INTEGER NOT NULL,
  end_minutes INTEGER NOT NULL,
  term TEXT NOT NULL DEFAULT '',
  date_range TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_schedule_entries TO authenticated;
GRANT ALL ON public.class_schedule_entries TO service_role;
ALTER TABLE public.class_schedule_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own schedule entries" ON public.class_schedule_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX class_schedule_entries_user_idx ON public.class_schedule_entries(user_id);
CREATE TRIGGER class_schedule_entries_updated_at BEFORE UPDATE ON public.class_schedule_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();