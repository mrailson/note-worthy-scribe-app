UPDATE public.nres_buyback_rate_settings
SET
  meeting_gp_rate = 100,
  meeting_pm_rate = 50,
  updated_at = now()
WHERE id = 'default';