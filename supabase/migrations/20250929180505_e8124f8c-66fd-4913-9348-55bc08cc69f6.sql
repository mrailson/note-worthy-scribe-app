-- Fix conflicting RLS policies for fridge temperature readings
-- Drop the restrictive policy that blocks public access
DROP POLICY IF EXISTS "Users with fridge access can record temperatures" ON public.fridge_temperature_readings;

-- Create a new policy that allows both authenticated users with access AND public access
CREATE POLICY "Allow temperature recordings" 
ON public.fridge_temperature_readings 
FOR INSERT 
WITH CHECK (
  -- Allow public access (recorded_by can be NULL)
  recorded_by IS NULL 
  OR 
  -- Allow authenticated users with fridge monitoring access
  (
    auth.uid() = recorded_by AND
    fridge_id IN (
      SELECT pf.id FROM public.practice_fridges pf
      JOIN public.user_roles ur ON ur.practice_id = pf.practice_id
      WHERE ur.user_id = auth.uid() AND ur.fridge_monitoring_access = true
    )
  )
);