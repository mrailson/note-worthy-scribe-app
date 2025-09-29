-- Add initials column to fridge_temperature_readings table
ALTER TABLE public.fridge_temperature_readings 
ADD COLUMN recorded_by_initials TEXT CHECK (char_length(recorded_by_initials) <= 2);