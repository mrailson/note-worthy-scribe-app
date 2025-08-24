-- Create ICB formulary table to store formulary data
CREATE TABLE IF NOT EXISTS public.icb_formulary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  drug_name TEXT NOT NULL,
  status TEXT NOT NULL,
  prior_approval_required BOOLEAN NOT NULL DEFAULT false,
  notes_restrictions TEXT,
  therapeutic_area TEXT,
  icb_region TEXT NOT NULL DEFAULT 'NHS Northamptonshire ICB',
  source_document TEXT,
  source_page TEXT,
  last_reviewed_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create an index on drug_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_icb_formulary_drug_name ON public.icb_formulary(drug_name);

-- Create an index on status for filtering
CREATE INDEX IF NOT EXISTS idx_icb_formulary_status ON public.icb_formulary(status);

-- Create an index on therapeutic_area for categorization
CREATE INDEX IF NOT EXISTS idx_icb_formulary_therapeutic_area ON public.icb_formulary(therapeutic_area);

-- Enable Row Level Security
ALTER TABLE public.icb_formulary ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read formulary data
CREATE POLICY "Authenticated users can view ICB formulary" 
ON public.icb_formulary 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Create policy for system admins to manage formulary data
CREATE POLICY "System admins can manage ICB formulary" 
ON public.icb_formulary 
FOR ALL 
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_icb_formulary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_icb_formulary_updated_at
BEFORE UPDATE ON public.icb_formulary
FOR EACH ROW
EXECUTE FUNCTION public.update_icb_formulary_updated_at();