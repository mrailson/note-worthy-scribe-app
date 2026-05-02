INSERT INTO public.system_settings (setting_key, setting_value, updated_at)
VALUES ('MEETING_PRIMARY_MODEL', '"claude-sonnet-4-6"'::jsonb, now())
ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = EXCLUDED.setting_value,
      updated_at    = now();