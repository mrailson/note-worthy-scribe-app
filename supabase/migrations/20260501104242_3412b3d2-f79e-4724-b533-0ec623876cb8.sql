UPDATE public.nres_buyback_rate_settings
SET management_roles_config = (
  SELECT jsonb_agg(
    CASE
      WHEN role->>'key' = 'nres_deputy_ops' OR role->>'person_name' = 'Lucy Hibberd'
        THEN jsonb_set(role, '{max_hours_per_week}', '6'::jsonb)
      ELSE role
    END
  )
  FROM jsonb_array_elements(management_roles_config::jsonb) AS role
)
WHERE id = 'default';