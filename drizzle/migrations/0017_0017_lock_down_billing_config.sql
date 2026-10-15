DROP POLICY IF EXISTS "billing config is public" ON public.billing_config;
REVOKE SELECT ON public.billing_config FROM anon, authenticated;