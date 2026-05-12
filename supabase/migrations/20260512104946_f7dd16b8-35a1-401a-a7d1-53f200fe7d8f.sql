
CREATE TABLE public.complaint_indemnity_risk_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('green','amber','red')),
  recommendation TEXT NOT NULL CHECK (recommendation IN ('no_action','consider_mdo','contact_mdo_now')),
  suggested_mdo TEXT NOT NULL DEFAULT 'unknown' CHECK (suggested_mdo IN ('mdu','mps','other','unknown')),
  rationale TEXT[] NOT NULL DEFAULT '{}',
  red_flags TEXT[] NOT NULL DEFAULT '{}',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  model TEXT,
  prompt_version TEXT,
  generated_by UUID,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  is_stale BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(complaint_id)
);

ALTER TABLE public.complaint_indemnity_risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View risk assessments for own complaints"
  ON public.complaint_indemnity_risk_assessments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Insert risk assessments for own complaints"
  ON public.complaint_indemnity_risk_assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Update risk assessments for own complaints"
  ON public.complaint_indemnity_risk_assessments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Delete risk assessments for own complaints"
  ON public.complaint_indemnity_risk_assessments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE TRIGGER update_indemnity_risk_assessments_updated_at
  BEFORE UPDATE ON public.complaint_indemnity_risk_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_complaint_indemnity_risk_complaint ON public.complaint_indemnity_risk_assessments(complaint_id);
CREATE INDEX idx_complaint_indemnity_risk_level ON public.complaint_indemnity_risk_assessments(risk_level);
