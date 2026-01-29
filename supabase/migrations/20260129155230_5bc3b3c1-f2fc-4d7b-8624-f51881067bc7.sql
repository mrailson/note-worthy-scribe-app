-- Update gp_practices table
UPDATE gp_practices 
SET name = 'Brackley & Towcester PCN' 
WHERE id = 'c800c954-3928-4a37-a5c4-c4ff3e680333';

-- Update practice_details table
UPDATE practice_details 
SET practice_name = 'Brackley & Towcester PCN' 
WHERE practice_name ILIKE '%oak lane%';