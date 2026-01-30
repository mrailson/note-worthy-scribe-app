-- Add member_practice column to nres_claimants for tracking which PCN practice the claimant belongs to
ALTER TABLE public.nres_claimants 
ADD COLUMN member_practice text;

-- Add a comment to document the allowed values
COMMENT ON COLUMN public.nres_claimants.member_practice IS 'PCN member practice: Brackley, Springfield, Brook, Towcester, Denton, Bugbrooke, The Parks, or Brackley & Towcester PCN';