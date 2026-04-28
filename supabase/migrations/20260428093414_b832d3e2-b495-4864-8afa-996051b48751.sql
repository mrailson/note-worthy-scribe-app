WITH source_user AS (
  SELECT id
  FROM auth.users
  WHERE lower(email) = 'malcolm.railson@nhs.net'
  LIMIT 1
),
target_user AS (
  SELECT id
  FROM auth.users
  WHERE lower(email) = 'lucy.hibberd@nhs.net'
  LIMIT 1
),
source_population_risk_roles AS (
  SELECT
    tu.id AS target_user_id,
    ur.role,
    ur.practice_id,
    ur.practice_role,
    ur.narp_upload_access,
    ur.can_view_narp_identifiable,
    ur.can_export_narp_identifiable
  FROM public.user_roles ur
  JOIN source_user su ON ur.user_id = su.id
  CROSS JOIN target_user tu
  WHERE ur.narp_upload_access = true
     OR ur.can_view_narp_identifiable = true
     OR ur.can_export_narp_identifiable = true
),
upserted_roles AS (
  INSERT INTO public.user_roles (
    user_id,
    role,
    practice_id,
    practice_role,
    narp_upload_access,
    can_view_narp_identifiable,
    can_export_narp_identifiable,
    assigned_at,
    created_at
  )
  SELECT
    target_user_id,
    role,
    practice_id,
    practice_role,
    narp_upload_access,
    can_view_narp_identifiable,
    can_export_narp_identifiable,
    now(),
    now()
  FROM source_population_risk_roles
  ON CONFLICT (user_id, role, practice_id)
  DO UPDATE SET
    narp_upload_access = public.user_roles.narp_upload_access OR EXCLUDED.narp_upload_access,
    can_view_narp_identifiable = public.user_roles.can_view_narp_identifiable OR EXCLUDED.can_view_narp_identifiable,
    can_export_narp_identifiable = public.user_roles.can_export_narp_identifiable OR EXCLUDED.can_export_narp_identifiable,
    practice_role = COALESCE(public.user_roles.practice_role, EXCLUDED.practice_role),
    assigned_at = now()
  RETURNING id
)
INSERT INTO public.user_service_activations (user_id, service, activated_at)
SELECT tu.id, 'nres', now()
FROM target_user tu
ON CONFLICT (user_id, service) DO NOTHING;