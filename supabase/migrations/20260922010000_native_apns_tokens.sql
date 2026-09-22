CREATE TABLE IF NOT EXISTS public.native_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'ios' CHECK (platform = 'ios'),
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  failure_count integer NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.native_push_tokens TO authenticated;
GRANT ALL ON public.native_push_tokens TO service_role;
ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own native push tokens" ON public.native_push_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX native_push_tokens_user_idx ON public.native_push_tokens (user_id);
