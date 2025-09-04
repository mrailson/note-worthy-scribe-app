-- Check if complaint_investigation_evidence table has RLS enabled
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'complaint_investigation_evidence';

-- Enable RLS on complaint_investigation_evidence if not already enabled
ALTER TABLE public.complaint_investigation_evidence ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for complaint_investigation_evidence
CREATE POLICY "Authenticated users can create investigation evidence" 
ON public.complaint_investigation_evidence 
FOR INSERT 
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can view investigation evidence for accessible complaints" 
ON public.complaint_investigation_evidence 
FOR SELECT 
USING (
  complaint_id IN (
    SELECT c.id FROM public.complaints c
    WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    OR c.created_by = auth.uid()
    OR has_role(auth.uid(), 'system_admin'::app_role)
  )
);

CREATE POLICY "Authorized users can update investigation evidence" 
ON public.complaint_investigation_evidence 
FOR UPDATE 
USING (
  auth.uid() = uploaded_by 
  OR has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Authorized users can delete investigation evidence" 
ON public.complaint_investigation_evidence 
FOR DELETE 
USING (
  auth.uid() = uploaded_by 
  OR has_role(auth.uid(), 'system_admin'::app_role)
);