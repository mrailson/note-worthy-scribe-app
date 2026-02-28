-- Ensure these claimants are visible to Admin Claims Report under current RLS scope
UPDATE public.nres_claimants
SET practice_id = 'c800c954-3928-4a37-a5c4-c4ff3e680333',
    member_practice = CASE
      WHEN name IN ('Lorraine Spicer', 'Rachel Parry') THEN 'Bugbrooke Medical Practice'
      WHEN name IN ('Dr Muhammad Asim Chishti', 'Charlotte Barnell') THEN 'The Parks Medical Practice'
      ELSE member_practice
    END,
    updated_at = now()
WHERE name IN ('Lorraine Spicer', 'Rachel Parry', 'Dr Muhammad Asim Chishti', 'Charlotte Barnell');