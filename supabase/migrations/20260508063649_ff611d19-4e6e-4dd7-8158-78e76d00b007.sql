-- Insert user_roles record for Angelique Smit using the correct auth.users ID
INSERT INTO public.user_roles (
  user_id,
  role,
  agewell_access,
  fridge_monitoring_access,
  narp_upload_access,
  can_view_narp_identifiable,
  can_export_narp_identifiable
) VALUES (
  'afd66025-4f77-4cf8-923b-323adda66f68',
  'practice_user',
  true,
  false,
  false,
  false,
  false
)
ON CONFLICT DO NOTHING;

-- Verify
SELECT id, user_id, role, agewell_access FROM public.user_roles WHERE user_id = 'afd66025-4f77-4cf8-923b-323adda66f68';