-- Canvas access tokens are write-only from browser clients. Previously the
-- table-level SELECT grant let any authenticated user read their own raw token
-- through PostgREST, despite the application UI exposing only a boolean.
REVOKE SELECT ON TABLE public.user_settings FROM authenticated;
GRANT SELECT (user_id, canvas_domain, created_at, updated_at)
  ON TABLE public.user_settings TO authenticated;

-- This zero-argument helper remains safe as SECURITY DEFINER because it can
-- only inspect auth.uid() and never accepts a caller-selected user id.
CREATE OR REPLACE FUNCTION public.has_canvas_key()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_settings
    WHERE user_id = auth.uid()
      AND canvas_api_key IS NOT NULL
      AND length(btrim(canvas_api_key)) > 0
  )
$$;

REVOKE ALL ON FUNCTION public.has_canvas_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_canvas_key() TO authenticated, service_role;
