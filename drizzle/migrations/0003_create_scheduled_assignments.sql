CREATE TABLE public.scheduled_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  assignment_id bigint NOT NULL,
  course_id bigint,
  title text NOT NULL,
  course_label text,
  due_at timestamptz NOT NULL,
  html_url text,
  google_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, assignment_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_assignments TO authenticated;
GRANT ALL ON public.scheduled_assignments TO service_role;

ALTER TABLE public.scheduled_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own scheduled assignments"
  ON public.scheduled_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own scheduled assignments"
  ON public.scheduled_assignments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own scheduled assignments"
  ON public.scheduled_assignments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own scheduled assignments"
  ON public.scheduled_assignments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX scheduled_assignments_user_due_idx
  ON public.scheduled_assignments (user_id, due_at);