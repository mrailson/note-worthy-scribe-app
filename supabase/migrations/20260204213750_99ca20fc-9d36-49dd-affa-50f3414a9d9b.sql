-- Create table for Mock CQC Inspection access sharing
CREATE TABLE IF NOT EXISTS public.mock_inspection_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.mock_inspection_sessions(id) ON DELETE CASCADE,
  granted_to_user_id UUID NOT NULL,
  granted_by_user_id UUID NOT NULL,
  can_edit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, granted_to_user_id)
);

-- Enable RLS
ALTER TABLE public.mock_inspection_access ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user has access to a session
CREATE OR REPLACE FUNCTION public.has_mock_inspection_access(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Owner always has access
    SELECT 1 FROM public.mock_inspection_sessions 
    WHERE id = p_session_id AND user_id = p_user_id
  ) OR EXISTS (
    -- Shared access
    SELECT 1 FROM public.mock_inspection_access
    WHERE session_id = p_session_id AND granted_to_user_id = p_user_id
  ) OR public.is_system_admin(p_user_id)
$$;

-- Policies for mock_inspection_access table
CREATE POLICY "Users can view access grants for sessions they own or are granted"
ON public.mock_inspection_access
FOR SELECT
USING (
  public.has_mock_inspection_access(session_id, auth.uid())
);

CREATE POLICY "Session owners and admins can insert access grants"
ON public.mock_inspection_access
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.mock_inspection_sessions 
    WHERE id = session_id AND user_id = auth.uid()
  ) OR public.is_system_admin(auth.uid())
);

CREATE POLICY "Session owners and admins can update access grants"
ON public.mock_inspection_access
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.mock_inspection_sessions 
    WHERE id = session_id AND user_id = auth.uid()
  ) OR public.is_system_admin(auth.uid())
);

CREATE POLICY "Session owners and admins can delete access grants"
ON public.mock_inspection_access
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.mock_inspection_sessions 
    WHERE id = session_id AND user_id = auth.uid()
  ) OR public.is_system_admin(auth.uid())
);

-- Update existing RLS policies on mock_inspection_sessions to allow shared access
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.mock_inspection_sessions;
CREATE POLICY "Users can view accessible sessions"
ON public.mock_inspection_sessions
FOR SELECT
USING (
  user_id = auth.uid() 
  OR public.has_mock_inspection_access(id, auth.uid())
);

-- Update mock_inspection_elements policies
DROP POLICY IF EXISTS "Users can view their own elements" ON public.mock_inspection_elements;
CREATE POLICY "Users can view accessible elements"
ON public.mock_inspection_elements
FOR SELECT
USING (
  public.has_mock_inspection_access(session_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own elements" ON public.mock_inspection_elements;
CREATE POLICY "Users can update accessible elements"
ON public.mock_inspection_elements
FOR UPDATE
USING (
  public.has_mock_inspection_access(session_id, auth.uid())
);

-- Update mock_inspection_fundamentals policies
DROP POLICY IF EXISTS "Users can view their own fundamentals" ON public.mock_inspection_fundamentals;
CREATE POLICY "Users can view accessible fundamentals"
ON public.mock_inspection_fundamentals
FOR SELECT
USING (
  public.has_mock_inspection_access(session_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own fundamentals" ON public.mock_inspection_fundamentals;
CREATE POLICY "Users can insert accessible fundamentals"
ON public.mock_inspection_fundamentals
FOR INSERT
WITH CHECK (
  public.has_mock_inspection_access(session_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own fundamentals" ON public.mock_inspection_fundamentals;
CREATE POLICY "Users can update accessible fundamentals"
ON public.mock_inspection_fundamentals
FOR UPDATE
USING (
  public.has_mock_inspection_access(session_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their own fundamentals" ON public.mock_inspection_fundamentals;
CREATE POLICY "Users can delete accessible fundamentals"
ON public.mock_inspection_fundamentals
FOR DELETE
USING (
  public.has_mock_inspection_access(session_id, auth.uid())
);

-- Update mock_inspection_custom_assignees policies
DROP POLICY IF EXISTS "Users can view their own custom assignees" ON public.mock_inspection_custom_assignees;
CREATE POLICY "Users can view accessible custom assignees"
ON public.mock_inspection_custom_assignees
FOR SELECT
USING (
  public.has_mock_inspection_access(session_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own custom assignees" ON public.mock_inspection_custom_assignees;
CREATE POLICY "Users can insert accessible custom assignees"
ON public.mock_inspection_custom_assignees
FOR INSERT
WITH CHECK (
  public.has_mock_inspection_access(session_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their own custom assignees" ON public.mock_inspection_custom_assignees;
CREATE POLICY "Users can delete accessible custom assignees"
ON public.mock_inspection_custom_assignees
FOR DELETE
USING (
  public.has_mock_inspection_access(session_id, auth.uid())
);