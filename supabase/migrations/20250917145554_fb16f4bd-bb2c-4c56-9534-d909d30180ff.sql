-- Fix typo in neighbourhood name
UPDATE public.neighbourhoods 
SET name = 'Rural North and West'
WHERE name = 'Rural North and Wes';