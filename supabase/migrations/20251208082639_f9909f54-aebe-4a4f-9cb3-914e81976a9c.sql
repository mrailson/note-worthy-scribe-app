-- Add service_level column to lg_patients table to track which processing tier was used
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS service_level text DEFAULT 'full_service' CHECK (service_level IN ('rename_only', 'index_summary', 'full_service'));