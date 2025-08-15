-- Add missing fields to gp_practices table for complete practice management
ALTER TABLE public.gp_practices 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS postcode text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gp_practices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gp_practices_updated_at
  BEFORE UPDATE ON public.gp_practices
  FOR EACH ROW
  EXECUTE FUNCTION update_gp_practices_updated_at();