INSERT INTO user_roles (user_id, role, practice_id)
VALUES (
  '15fb5f6a-cc30-43e8-adbf-e945351a33c2',
  'practice_manager',
  '4bdacb14-cce9-4be2-a64c-79cd3598dac6'
)
ON CONFLICT (user_id, role, practice_id) DO NOTHING;