
-- Drop the existing check constraint on staff_category and recreate with gp_locum
ALTER TABLE public.nres_buyback_staff
  DROP CONSTRAINT IF EXISTS nres_buyback_staff_staff_category_check;

ALTER TABLE public.nres_buyback_staff
  ADD CONSTRAINT nres_buyback_staff_staff_category_check
  CHECK (staff_category IN ('buyback', 'new_sda', 'management', 'gp_locum'));
