-- Create table for complaint outcome questionnaires
CREATE TABLE public.complaint_outcome_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  questionnaire_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.complaint_outcome_questionnaires ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view questionnaires for their practice complaints
CREATE POLICY "Users can view questionnaires for their practice complaints"
ON public.complaint_outcome_questionnaires
FOR SELECT
USING (
  complaint_id IN (
    SELECT c.id FROM public.complaints c
    WHERE c.practice_id = ANY(get_user_practice_ids(auth.uid()))
    OR c.created_by = auth.uid()
  )
);

-- Policy: Authorized users can create questionnaires
CREATE POLICY "Authorized users can create questionnaires"
ON public.complaint_outcome_questionnaires
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND (
    is_system_admin(auth.uid())
    OR has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'complaints_manager'::app_role)
    OR complaint_id IN (
      SELECT c.id FROM public.complaints c
      WHERE c.practice_id = ANY(get_user_practice_ids(auth.uid()))
    )
  )
);

-- Add index for faster lookups
CREATE INDEX idx_complaint_outcome_questionnaires_complaint_id 
ON public.complaint_outcome_questionnaires(complaint_id);

-- Add trigger for updated_at
CREATE TRIGGER update_complaint_outcome_questionnaires_updated_at
BEFORE UPDATE ON public.complaint_outcome_questionnaires
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();