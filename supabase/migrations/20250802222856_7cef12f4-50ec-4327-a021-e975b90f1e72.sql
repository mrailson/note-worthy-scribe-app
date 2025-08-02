-- Create complaint_investigation_decisions table for AI-powered investigation decisions
CREATE TABLE public.complaint_investigation_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('uphold', 'reject', 'partially_uphold')),
  decision_reasoning TEXT NOT NULL,
  lessons_learned TEXT,
  decided_by UUID NOT NULL,
  decided_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_investigation_decisions ENABLE ROW LEVEL SECURITY;

-- Create policies for investigation decisions
CREATE POLICY "Users can create investigation decisions for their practice complaints"
ON public.complaint_investigation_decisions
FOR INSERT
WITH CHECK (
  complaint_id IN (
    SELECT c.id 
    FROM complaints c 
    WHERE (c.practice_id = ANY(get_user_practice_ids(auth.uid())) OR c.created_by = auth.uid())
  ) 
  AND auth.uid() = decided_by
);

CREATE POLICY "Users can view investigation decisions for their practice complaints"
ON public.complaint_investigation_decisions
FOR SELECT
USING (
  complaint_id IN (
    SELECT c.id 
    FROM complaints c 
    WHERE (c.practice_id = ANY(get_user_practice_ids(auth.uid())) OR c.created_by = auth.uid())
  )
);

CREATE POLICY "Users can update investigation decisions they created"
ON public.complaint_investigation_decisions
FOR UPDATE
USING (
  complaint_id IN (
    SELECT c.id 
    FROM complaints c 
    WHERE (c.practice_id = ANY(get_user_practice_ids(auth.uid())) OR c.created_by = auth.uid())
  ) 
  AND auth.uid() = decided_by
);

-- Add foreign key constraint
ALTER TABLE public.complaint_investigation_decisions
ADD CONSTRAINT complaint_investigation_decisions_complaint_id_fkey
FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE;

-- Add trigger for updating updated_at column
CREATE TRIGGER update_complaint_investigation_decisions_updated_at
  BEFORE UPDATE ON public.complaint_investigation_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();