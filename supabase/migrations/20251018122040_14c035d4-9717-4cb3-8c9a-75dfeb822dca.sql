-- Create practice_manager_feedback table
CREATE TABLE public.practice_manager_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES public.gp_practices(id) ON DELETE SET NULL,
  practice_name TEXT,
  would_use_complaints_system INTEGER NOT NULL CHECK (would_use_complaints_system >= 0 AND would_use_complaints_system <= 2),
  complaints_system_usefulness INTEGER NOT NULL CHECK (complaints_system_usefulness >= 0 AND complaints_system_usefulness <= 5),
  would_use_meeting_manager INTEGER NOT NULL CHECK (would_use_meeting_manager >= 0 AND would_use_meeting_manager <= 2),
  meeting_manager_usefulness INTEGER NOT NULL CHECK (meeting_manager_usefulness >= 0 AND meeting_manager_usefulness <= 5),
  comments TEXT,
  respondent_name TEXT,
  respondent_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  ip_address INET
);

-- Enable RLS
ALTER TABLE public.practice_manager_feedback ENABLE ROW LEVEL SECURITY;

-- Allow public INSERT (anyone can submit feedback)
CREATE POLICY "Anyone can submit feedback"
ON public.practice_manager_feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only system admins can SELECT
CREATE POLICY "System admins can view all feedback"
ON public.practice_manager_feedback
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

-- Only system admins can UPDATE
CREATE POLICY "System admins can update feedback"
ON public.practice_manager_feedback
FOR UPDATE
TO authenticated
USING (is_system_admin(auth.uid()));

-- Only system admins can DELETE
CREATE POLICY "System admins can delete feedback"
ON public.practice_manager_feedback
FOR DELETE
TO authenticated
USING (is_system_admin(auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_practice_manager_feedback_created_at ON public.practice_manager_feedback(created_at DESC);
CREATE INDEX idx_practice_manager_feedback_practice_id ON public.practice_manager_feedback(practice_id);
CREATE INDEX idx_practice_manager_feedback_ip_address ON public.practice_manager_feedback(ip_address);