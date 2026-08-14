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

REVOKE ALL ON FUNCTION public.has_canvas_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_canvas_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_canvas_key() TO service_role;