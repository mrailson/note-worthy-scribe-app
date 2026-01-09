-- Set Michael Chapman to PM-only view in AI4GP by setting hideGPClinical to true
INSERT INTO public.user_settings (user_id, setting_key, setting_value)
VALUES (
  'f0c921b6-d67d-47b9-b8e6-373aa6725bf9',
  'ai4gp_preferences',
  '{"hideGPClinical": true}'::jsonb
)
ON CONFLICT (user_id, setting_key) 
DO UPDATE SET setting_value = '{"hideGPClinical": true}'::jsonb, updated_at = now();