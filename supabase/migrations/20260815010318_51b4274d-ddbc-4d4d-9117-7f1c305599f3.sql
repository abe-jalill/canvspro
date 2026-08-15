CREATE OR REPLACE FUNCTION public.has_canvas_key()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_settings
    WHERE user_id = auth.uid()
      AND canvas_api_key IS NOT NULL
      AND length(btrim(canvas_api_key)) > 0
  )
$function$;

REVOKE EXECUTE ON FUNCTION public.has_canvas_key() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_canvas_key() FROM anon;
GRANT EXECUTE ON FUNCTION public.has_canvas_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_canvas_key() TO service_role;