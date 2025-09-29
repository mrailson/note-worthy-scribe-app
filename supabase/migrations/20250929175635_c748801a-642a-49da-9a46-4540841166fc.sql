-- Make recorded_by nullable for public temperature recordings
ALTER TABLE public.fridge_temperature_readings 
ALTER COLUMN recorded_by DROP NOT NULL;

-- Add a comment to document this change
COMMENT ON COLUMN public.fridge_temperature_readings.recorded_by IS 'User who recorded the temperature. Can be NULL for public/anonymous recordings via QR code.';