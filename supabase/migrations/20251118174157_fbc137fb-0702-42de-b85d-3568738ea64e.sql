-- Create DTAC assessments table
CREATE TABLE IF NOT EXISTS public.dtac_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES public.gp_practices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'submitted', 'approved')),
  version TEXT DEFAULT '1.0',
  
  -- Section A: Company Information
  company_info JSONB DEFAULT '{}'::jsonb,
  
  -- Section B: Value Proposition
  value_proposition JSONB DEFAULT '{}'::jsonb,
  
  -- Section C1: Clinical Safety
  clinical_safety JSONB DEFAULT '{}'::jsonb,
  
  -- Section C2: Data Protection
  data_protection JSONB DEFAULT '{}'::jsonb,
  
  -- Section C3: Technical Security
  technical_security JSONB DEFAULT '{}'::jsonb,
  
  -- Section C4: Interoperability
  interoperability JSONB DEFAULT '{}'::jsonb,
  
  -- Section D: Usability & Accessibility
  usability_accessibility JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.dtac_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own DTAC assessments"
  ON public.dtac_assessments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own DTAC assessments"
  ON public.dtac_assessments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own DTAC assessments"
  ON public.dtac_assessments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own DTAC assessments"
  ON public.dtac_assessments FOR DELETE
  USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_dtac_assessments_updated_at
  BEFORE UPDATE ON public.dtac_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create evidence attachments table
CREATE TABLE IF NOT EXISTS public.dtac_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.dtac_assessments(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for evidence
ALTER TABLE public.dtac_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence for their assessments"
  ON public.dtac_evidence FOR SELECT
  USING (
    assessment_id IN (
      SELECT id FROM public.dtac_assessments WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload evidence for their assessments"
  ON public.dtac_evidence FOR INSERT
  WITH CHECK (
    assessment_id IN (
      SELECT id FROM public.dtac_assessments WHERE user_id = auth.uid()
    )
  );