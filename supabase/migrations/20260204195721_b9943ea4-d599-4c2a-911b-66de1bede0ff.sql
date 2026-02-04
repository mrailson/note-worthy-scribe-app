-- Create table for site issues discovered during inspection walkthrough
CREATE TABLE public.mock_inspection_site_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.mock_inspection_sessions(id) ON DELETE CASCADE,
  description TEXT,
  photo_url TEXT,
  photo_file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mock_inspection_site_issues ENABLE ROW LEVEL SECURITY;

-- Users can view issues from their own sessions
CREATE POLICY "Users can view their own session issues"
  ON public.mock_inspection_site_issues
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mock_inspection_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- Users can insert issues into their own sessions
CREATE POLICY "Users can insert issues into their own sessions"
  ON public.mock_inspection_site_issues
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mock_inspection_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- Users can update their own session issues
CREATE POLICY "Users can update their own session issues"
  ON public.mock_inspection_site_issues
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.mock_inspection_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- Users can delete their own session issues
CREATE POLICY "Users can delete their own session issues"
  ON public.mock_inspection_site_issues
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.mock_inspection_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_mock_inspection_site_issues_updated_at
  BEFORE UPDATE ON public.mock_inspection_site_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();