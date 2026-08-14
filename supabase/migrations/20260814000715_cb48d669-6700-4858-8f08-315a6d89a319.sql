CREATE TABLE public.class_nicknames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canvas_course_id bigint NOT NULL,
  raw_name text,
  raw_code text,
  custom_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, canvas_course_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_nicknames TO authenticated;
GRANT ALL ON public.class_nicknames TO service_role;

ALTER TABLE public.class_nicknames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own class nicknames"
  ON public.class_nicknames FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own class nicknames"
  ON public.class_nicknames FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own class nicknames"
  ON public.class_nicknames FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own class nicknames"
  ON public.class_nicknames FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_class_nicknames_updated_at
  BEFORE UPDATE ON public.class_nicknames
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();