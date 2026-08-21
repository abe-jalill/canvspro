ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS seen_onboarding boolean NOT NULL DEFAULT false;