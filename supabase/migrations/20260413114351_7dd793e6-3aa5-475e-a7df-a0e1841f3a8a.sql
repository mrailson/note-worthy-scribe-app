-- Add 'meeting' to staff_category check constraint
ALTER TABLE nres_buyback_staff DROP CONSTRAINT nres_buyback_staff_staff_category_check;
ALTER TABLE nres_buyback_staff ADD CONSTRAINT nres_buyback_staff_staff_category_check
  CHECK (staff_category = ANY (ARRAY['buyback'::text, 'new_sda'::text, 'management'::text, 'gp_locum'::text, 'meeting'::text]));

-- Add 'daily' to allocation_type check constraint
ALTER TABLE nres_buyback_staff DROP CONSTRAINT nres_buyback_staff_allocation_type_check;
ALTER TABLE nres_buyback_staff ADD CONSTRAINT nres_buyback_staff_allocation_type_check
  CHECK (allocation_type = ANY (ARRAY['sessions'::text, 'wte'::text, 'hours'::text, 'daily'::text]));