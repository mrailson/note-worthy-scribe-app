-- Create meeting_shares table to track shared meetings
CREATE TABLE public.meeting_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  access_level TEXT NOT NULL DEFAULT 'view', -- 'view' or 'download'
  message TEXT, -- Optional message from the sharer
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate shares of the same meeting to the same email
  UNIQUE(meeting_id, shared_with_email)
);

-- Enable RLS on meeting_shares
ALTER TABLE public.meeting_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Users can share their own meetings
CREATE POLICY "Users can share their own meetings" 
ON public.meeting_shares 
FOR INSERT 
WITH CHECK (
  shared_by = auth.uid() AND
  meeting_id IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
  )
);

-- Policy: Users can view meetings shared with them
CREATE POLICY "Users can view meetings shared with them" 
ON public.meeting_shares 
FOR SELECT 
USING (
  shared_with_user_id = auth.uid() OR 
  shared_with_email = auth.email() OR
  shared_by = auth.uid()
);

-- Policy: Users can revoke shares they created
CREATE POLICY "Users can revoke their own shares" 
ON public.meeting_shares 
FOR DELETE 
USING (shared_by = auth.uid());

-- Update meetings policies to allow access to shared meetings
-- First, let's create a helper function to check if a user has access to a meeting
CREATE OR REPLACE FUNCTION public.user_has_meeting_access(p_meeting_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    -- User owns the meeting
    SELECT 1 FROM public.meetings 
    WHERE id = p_meeting_id AND user_id = p_user_id
    
    UNION
    
    -- Meeting is shared with user
    SELECT 1 FROM public.meeting_shares ms
    JOIN auth.users u ON u.id = p_user_id
    WHERE ms.meeting_id = p_meeting_id 
    AND (ms.shared_with_user_id = p_user_id OR ms.shared_with_email = u.email)
  );
$$;

-- Create a view for enhanced meeting access that includes shared meetings
CREATE OR REPLACE VIEW public.accessible_meetings AS
SELECT 
  m.*,
  CASE 
    WHEN m.user_id = auth.uid() THEN 'owner'
    ELSE 'shared'
  END AS access_type,
  ms.shared_by,
  ms.shared_at,
  ms.access_level,
  ms.message AS share_message
FROM public.meetings m
LEFT JOIN public.meeting_shares ms ON m.id = ms.meeting_id
WHERE 
  m.user_id = auth.uid() OR -- Own meetings
  (ms.shared_with_user_id = auth.uid() OR ms.shared_with_email = auth.email()); -- Shared meetings

-- Add function to update shared_with_user_id when user signs up
CREATE OR REPLACE FUNCTION public.update_meeting_shares_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Update any pending shares for this email
  UPDATE public.meeting_shares 
  SET shared_with_user_id = NEW.id
  WHERE shared_with_email = NEW.email 
  AND shared_with_user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update shares when user signs up
CREATE TRIGGER on_auth_user_created_update_shares
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_meeting_shares_on_signup();