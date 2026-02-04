-- Add fields to track issue assignment and fix timeline
ALTER TABLE public.mock_inspection_fundamentals
ADD COLUMN assigned_to TEXT,
ADD COLUMN fix_by_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN fix_by_preset TEXT;

-- Create table to store custom assignees per session (for reuse in that inspection)
CREATE TABLE public.mock_inspection_custom_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.mock_inspection_sessions(id) ON DELETE CASCADE,
  assignee_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, assignee_name)
);

-- Enable RLS
ALTER TABLE public.mock_inspection_custom_assignees ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can manage custom assignees for sessions they own
CREATE POLICY "Users can view custom assignees for their sessions"
ON public.mock_inspection_custom_assignees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.mock_inspection_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert custom assignees for their sessions"
ON public.mock_inspection_custom_assignees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.mock_inspection_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete custom assignees for their sessions"
ON public.mock_inspection_custom_assignees
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.mock_inspection_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  )
);