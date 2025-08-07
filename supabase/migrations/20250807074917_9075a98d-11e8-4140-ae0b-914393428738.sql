-- Create meeting_documents table
CREATE TABLE public.meeting_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.meeting_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can upload documents for their meetings"
ON public.meeting_documents
FOR INSERT
WITH CHECK (
  meeting_id IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
  ) AND uploaded_by = auth.uid()
);

CREATE POLICY "Users can view documents for their meetings"
ON public.meeting_documents
FOR SELECT
USING (
  meeting_id IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete documents from their meetings"
ON public.meeting_documents
FOR DELETE
USING (
  meeting_id IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
  ) AND uploaded_by = auth.uid()
);