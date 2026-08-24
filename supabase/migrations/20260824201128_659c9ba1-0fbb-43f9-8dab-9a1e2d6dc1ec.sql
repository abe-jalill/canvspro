CREATE TABLE public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own preferences" ON public.user_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX user_preferences_user_idx ON public.user_preferences(user_id);
CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_assignment_meta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  assignment_id BIGINT NOT NULL,
  course_id BIGINT NOT NULL,
  estimated_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, assignment_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_assignment_meta TO authenticated;
GRANT ALL ON public.user_assignment_meta TO service_role;
ALTER TABLE public.user_assignment_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own assignment meta" ON public.user_assignment_meta FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX user_assignment_meta_user_idx ON public.user_assignment_meta(user_id);
CREATE TRIGGER user_assignment_meta_updated_at BEFORE UPDATE ON public.user_assignment_meta FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.grade_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  course_id BIGINT NOT NULL,
  score NUMERIC NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id, recorded_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_snapshots TO authenticated;
GRANT ALL ON public.grade_snapshots TO service_role;
ALTER TABLE public.grade_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own grade snapshots" ON public.grade_snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX grade_snapshots_user_course_idx ON public.grade_snapshots(user_id, course_id, recorded_at DESC);