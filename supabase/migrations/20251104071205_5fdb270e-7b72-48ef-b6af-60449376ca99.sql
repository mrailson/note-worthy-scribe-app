-- Update all existing complaints to link them to Oak Lane Medical Practice
UPDATE public.complaints 
SET practice_id = 'c800c954-3928-4a37-a5c4-c4ff3e680333'
WHERE practice_id IS NULL;