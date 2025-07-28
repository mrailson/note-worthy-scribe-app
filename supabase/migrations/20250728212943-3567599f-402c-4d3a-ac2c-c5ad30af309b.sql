-- Remove the unique constraint that prevents multiple staff assignments to the same shift
ALTER TABLE public.staff_assignments DROP CONSTRAINT IF EXISTS staff_assignments_shift_template_id_assignment_date_key;

-- Add a new unique constraint that allows multiple staff but prevents duplicate assignments of the same staff member to the same shift
ALTER TABLE public.staff_assignments ADD CONSTRAINT staff_assignments_unique_staff_shift_date 
  UNIQUE (shift_template_id, staff_member_id, assignment_date);