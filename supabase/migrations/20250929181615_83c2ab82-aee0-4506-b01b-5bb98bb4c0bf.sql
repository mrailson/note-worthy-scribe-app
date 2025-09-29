-- Check RLS status and create proper policy for fridge temperature readings
SELECT 'Current RLS status: ' || CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END
FROM pg_class 
WHERE relname = 'fridge_temperature_readings';

-- Enable RLS if not already enabled
ALTER TABLE public.fridge_temperature_readings ENABLE ROW LEVEL SECURITY;

-- Create a comprehensive policy that allows all temperature recordings
-- This policy allows both public (QR code) and authenticated access
CREATE POLICY "Allow all temperature recordings" 
ON public.fridge_temperature_readings 
FOR INSERT 
WITH CHECK (true);

-- Also add SELECT policy for viewing readings
CREATE POLICY "Allow viewing temperature readings"
ON public.fridge_temperature_readings
FOR SELECT
USING (true);

-- Add UPDATE policy for any updates
CREATE POLICY "Allow updating temperature readings"
ON public.fridge_temperature_readings
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Add DELETE policy for cleanup
CREATE POLICY "Allow deleting temperature readings"
ON public.fridge_temperature_readings
FOR DELETE
USING (true);