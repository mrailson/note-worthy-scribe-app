INSERT INTO public.user_roles (
  user_id,
  role,
  practice_id,
  can_view_narp_identifiable,
  can_export_narp_identifiable
)
SELECT
  '9db2022b-f6ac-41eb-85e9-feb9886fa7bf'::uuid,
  'practice_manager'::public.app_role,
  gp.id,
  true,
  false
FROM public.gp_practices gp
ON CONFLICT (user_id, role, practice_id)
DO UPDATE SET
  can_view_narp_identifiable = true,
  can_export_narp_identifiable = false;