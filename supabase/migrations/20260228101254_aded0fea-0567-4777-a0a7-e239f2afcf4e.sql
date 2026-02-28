-- Fix claimant practice mappings used by Admin Claims Report
UPDATE public.nres_claimants
SET member_practice = 'The Parks Medical Practice',
    updated_at = now()
WHERE name IN ('Dr Muhammad Asim Chishti', 'Charlotte Barnell');