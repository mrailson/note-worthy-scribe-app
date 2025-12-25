-- Address linter warnings: set immutable search_path on trigger helper functions

BEGIN;

ALTER FUNCTION public.update_audio_sessions_updated_at() SET search_path = public;
ALTER FUNCTION public.update_cso_updated_at() SET search_path = public;

COMMIT;
