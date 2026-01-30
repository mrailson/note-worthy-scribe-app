-- Update all 'Brackley' entries to 'Brackley Medical Centre' for consistency
UPDATE nres_claimants 
SET member_practice = 'Brackley Medical Centre' 
WHERE member_practice = 'Brackley';