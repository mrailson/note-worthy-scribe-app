-- Seed MEETING_PRIMARY_MODEL feature flag (idempotent)
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'MEETING_PRIMARY_MODEL',
  '"gemini-3-flash"'::jsonb,
  'Primary LLM used by auto-generate-meeting-notes. Allowed values: "gemini-3-flash", "gemini-3.1-pro". Flash is the safe default — Pro currently exhausts its token budget on internal reasoning before producing output.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Allow authenticated users to READ this setting (the edge function uses
-- the service role key so this isn't strictly needed for it, but the admin
-- dashboard reads it from the client). Limit to specific operational keys only.
DROP POLICY IF EXISTS "Anyone authenticated can read operational settings" ON public.system_settings;
CREATE POLICY "Anyone authenticated can read operational settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (setting_key IN ('MEETING_PRIMARY_MODEL'));