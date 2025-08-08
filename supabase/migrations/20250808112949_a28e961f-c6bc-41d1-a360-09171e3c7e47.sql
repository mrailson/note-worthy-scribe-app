-- Fix security warnings: Update function with proper search path
CREATE OR REPLACE FUNCTION public.update_medical_corrections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp';