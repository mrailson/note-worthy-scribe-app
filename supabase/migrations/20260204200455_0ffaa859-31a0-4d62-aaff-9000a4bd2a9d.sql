-- Create fundamentals checklist items table for mock inspections
CREATE TABLE public.mock_inspection_fundamentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.mock_inspection_sessions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_checked' CHECK (status IN ('not_checked', 'verified', 'issue_found', 'not_applicable')),
  notes TEXT,
  photo_url TEXT,
  photo_file_name TEXT,
  checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, item_key)
);

-- Enable RLS
ALTER TABLE public.mock_inspection_fundamentals ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can manage their own session's fundamentals
CREATE POLICY "Users can view their own fundamentals"
ON public.mock_inspection_fundamentals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.mock_inspection_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own fundamentals"
ON public.mock_inspection_fundamentals
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.mock_inspection_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own fundamentals"
ON public.mock_inspection_fundamentals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.mock_inspection_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own fundamentals"
ON public.mock_inspection_fundamentals
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.mock_inspection_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  )
);