-- Create ICB Formulary table
CREATE TABLE IF NOT EXISTS public.icb_formulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_norm TEXT UNIQUE NOT NULL,
  bnf_chapter TEXT,
  formulary_status TEXT,
  detail_url TEXT,
  prior_approval_required BOOLEAN NOT NULL DEFAULT false,
  prior_approval_pdf_url TEXT,
  prior_approval_page_ref TEXT,
  last_reviewed TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'ICN ICB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
ALTER TABLE public.icb_formulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prior_approval_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_synonyms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access (since these are reference data)
CREATE POLICY "Authenticated users can view ICB formulary" ON public.icb_formulary
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can view prior approval criteria" ON public.prior_approval_criteria
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can view drug synonyms" ON public.drug_synonyms
  FOR SELECT USING (true);

-- System admins can manage formulary data
CREATE POLICY "System admins can manage ICB formulary" ON public.icb_formulary
  FOR ALL USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage prior approval criteria" ON public.prior_approval_criteria
  FOR ALL USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage drug synonyms" ON public.drug_synonyms
  FOR ALL USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Insert Insuject data as example
INSERT INTO public.icb_formulary (name, name_norm, bnf_chapter, prior_approval_required, prior_approval_pdf_url, prior_approval_page_ref, last_reviewed, source)
VALUES ('Insuject', 'insuject', '06 - Endocrine system', true,
        'https://www.icnorthamptonshire.org.uk/download.cfm?doc=docm93jijm4n22499&ver=66342',
        'Section: Double Red Devices; Page 14', now(), 'ICN ICB')
ON CONFLICT (name_norm) DO UPDATE
SET prior_approval_required = EXCLUDED.prior_approval_required,
    prior_approval_pdf_url = EXCLUDED.prior_approval_pdf_url,
    prior_approval_page_ref = EXCLUDED.prior_approval_page_ref,
    last_reviewed = EXCLUDED.last_reviewed,
    updated_at = now();

-- Insert Insuject prior approval criteria
INSERT INTO public.prior_approval_criteria (drug_name_norm, criteria_text, category, application_route, icb_version, icb_pdf_url)
VALUES
('insuject', 'Only for patients meeting ICB criteria for insulin delivery devices where safety and dexterity needs are documented in primary care notes.', 'Double Red – Prior Approval', 'Blueteq', 'Aug 2025 (v6.6.342)',
 'https://www.icnorthamptonshire.org.uk/download.cfm?doc=docm93jijm4n22499&ver=66342'),
('insuject', 'Evidence required: prior unsuccessful trial of alternative devices OR documented clinical need (e.g., visual impairment, manual dexterity limitation).', 'Double Red – Prior Approval', 'Blueteq', 'Aug 2025 (v6.6.342)',
 'https://www.icnorthamptonshire.org.uk/download.cfm?doc=docm93jijm4n22499&ver=66342');