-- Clear all drug-related data for fresh import
TRUNCATE TABLE public.traffic_light_medicines CASCADE;
TRUNCATE TABLE public.prior_approval_criteria CASCADE;
TRUNCATE TABLE public.icb_formulary CASCADE;

-- Reset any sequences if they exist
-- This ensures IDs start fresh if needed