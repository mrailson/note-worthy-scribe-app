-- First, alter the existing icb_formulary table to match the specification
ALTER TABLE public.icb_formulary 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS name_norm TEXT,
ADD COLUMN IF NOT EXISTS bnf_chapter TEXT,
ADD COLUMN IF NOT EXISTS formulary_status TEXT,
ADD COLUMN IF NOT EXISTS detail_url TEXT,
ADD COLUMN IF NOT EXISTS prior_approval_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS prior_approval_page_ref TEXT,
ADD COLUMN IF NOT EXISTS last_reviewed TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ICN ICB';

-- Update existing data to populate the new name columns from drug_name
UPDATE public.icb_formulary 
SET name = drug_name,
    name_norm = lower(regexp_replace(drug_name, '[^a-zA-Z0-9]+', '', 'g'))
WHERE name IS NULL;

-- Update formulary_status from existing status column
UPDATE public.icb_formulary 
SET formulary_status = status
WHERE formulary_status IS NULL;

-- Make name_norm unique after populating it
ALTER TABLE public.icb_formulary 
ADD CONSTRAINT icb_formulary_name_norm_unique UNIQUE (name_norm);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_icb_formulary_name_norm ON public.icb_formulary(name_norm);

-- Create Prior Approval Criteria table
CREATE TABLE IF NOT EXISTS public.prior_approval_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name_norm TEXT NOT NULL,
  criteria_text TEXT NOT NULL,
  category TEXT,
  application_route TEXT,
  application_url TEXT,
  evidence_required TEXT,
  review_interval_months INTEGER,
  icb_version TEXT,
  icb_pdf_url TEXT,
  effective_from DATE,
  effective_to DATE,
  last_scraped TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for joining with formulary
CREATE INDEX IF NOT EXISTS idx_prior_approval_criteria_drug ON public.prior_approval_criteria(drug_name_norm);

-- Create Drug Synonyms table (optional)
CREATE TABLE IF NOT EXISTS public.drug_synonyms (
  drug_name_norm TEXT NOT NULL,
  synonym_norm TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (drug_name_norm, synonym_norm)
);

-- Create index for synonym lookups
CREATE INDEX IF NOT EXISTS idx_drug_synonyms_syn ON public.drug_synonyms(synonym_norm);

-- Enable RLS on new tables
ALTER TABLE public.prior_approval_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_synonyms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access (since these are reference data)
CREATE POLICY "Authenticated users can view prior approval criteria" ON public.prior_approval_criteria
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can view drug synonyms" ON public.drug_synonyms
  FOR SELECT USING (true);

-- System admins can manage formulary data
CREATE POLICY "System admins can manage prior approval criteria" ON public.prior_approval_criteria
  FOR ALL USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage drug synonyms" ON public.drug_synonyms
  FOR ALL USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));