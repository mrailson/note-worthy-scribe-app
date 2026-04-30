UPDATE public.nres_buyback_rate_settings
SET management_roles_config = (
  SELECT jsonb_agg(e)
  FROM jsonb_array_elements(management_roles_config) e
  WHERE e->>'key' NOT IN ('nres_attend_gp_1776258657087', 'nres_attend_pm_1776258715527')
),
updated_at = now()
WHERE id = 'default';