-- Set default LG Capture settings for Julia Railson
INSERT INTO user_settings (user_id, setting_key, setting_value)
VALUES (
  'fcfad128-2a65-4fd0-8b15-5d990262172f',
  'lg_capture_defaults',
  '{"practiceOds": "K83064", "uploaderName": "Julia Railson"}'::jsonb
)
ON CONFLICT (user_id, setting_key) 
DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now();