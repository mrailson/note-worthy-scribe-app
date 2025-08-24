-- Clear all drug-related data for fresh import attempt
TRUNCATE TABLE public.traffic_light_medicines CASCADE;
TRUNCATE TABLE public.prior_approval_criteria CASCADE;
TRUNCATE TABLE public.icb_formulary CASCADE;