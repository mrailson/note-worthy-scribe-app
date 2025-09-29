-- Grant fridge monitoring access to Anita Carter
UPDATE public.user_roles
SET fridge_monitoring_access = true
WHERE user_id = '0f36cc1e-1a4d-43cb-a4d3-6e5a5e799ac0';