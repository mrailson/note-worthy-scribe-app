-- Clean up conflicting RLS policies and create a single working policy for temperature readings

-- Drop all existing INSERT policies for fridge_temperature_readings
DROP POLICY IF EXISTS "Allow temperature recordings" ON public.fridge_temperature_readings;
DROP POLICY IF EXISTS "Public can record temperature readings" ON public.fridge_temperature_readings;

-- Create a unified INSERT policy that works for both authenticated and public users
CREATE POLICY "Unified temperature recording policy" 
ON public.fridge_temperature_readings 
FOR INSERT 
WITH CHECK (
  -- Always allow public temperature recordings (no authentication required)
  true
);