-- Update default expiry from 30 minutes to 1 hour for new sessions
ALTER TABLE public.reception_translation_sessions
ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '1 hour');