-- Fix the foreign key relationship for supplier incidents
-- First, check if profiles table exists and then fix the relationship

-- Update the supplier incidents query to properly reference the profiles table
-- The issue is that 'reported_by' field needs proper foreign key setup

-- Add foreign key constraint if missing
DO $$
BEGIN
  -- Check if the foreign key constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'supplier_incidents_reported_by_fkey'
  ) THEN
    -- Add foreign key constraint
    ALTER TABLE public.supplier_incidents 
    ADD CONSTRAINT supplier_incidents_reported_by_fkey 
    FOREIGN KEY (reported_by) REFERENCES public.profiles(user_id);
  END IF;
END $$;