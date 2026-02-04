-- Ensure LG Capture is visible in Malcolm Railson's Select Service menu
-- (user_id taken from profiles: malcolm.railson@nhs.net)
insert into public.user_settings (user_id, setting_key, setting_value, updated_at)
values (
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'service_visibility',
  jsonb_build_object('lg_capture', true),
  now()
)
on conflict (user_id, setting_key)
do update set
  setting_value = jsonb_set(
    coalesce(public.user_settings.setting_value, '{}'::jsonb),
    '{lg_capture}',
    'true'::jsonb,
    true
  ),
  updated_at = now();
