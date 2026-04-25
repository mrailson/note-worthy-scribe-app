INSERT INTO public.user_roles (
  user_id,
  role,
  practice_id,
  can_view_narp_identifiable,
  can_export_narp_identifiable
)
SELECT
  'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid,
  role,
  practice_id,
  true,
  false
FROM public.user_roles
WHERE user_id = '9db2022b-f6ac-41eb-85e9-feb9886fa7bf'::uuid
  AND can_view_narp_identifiable = true
  AND practice_id IS NOT NULL
ON CONFLICT (user_id, role, practice_id)
DO UPDATE SET
  can_view_narp_identifiable = true,
  can_export_narp_identifiable = false;