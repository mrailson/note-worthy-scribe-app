-- Remove Banbury Cross Health Centre from practices
DELETE FROM public.gp_practices 
WHERE name = 'Banbury Cross Health Centre' AND practice_code = 'M85001';