-- Update meeting retention setting for matthew.hutton3@nhs.net to 1 year (365 days)
INSERT INTO user_settings (user_id, setting_key, setting_value)
VALUES (
  (SELECT user_id FROM profiles WHERE email = 'matthew.hutton3@nhs.net'),
  'meeting_retention_days',
  '365'
)
ON CONFLICT (user_id, setting_key) 
DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = now();