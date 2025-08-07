-- Fix security issues from the previous migration

-- 1. Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.accessible_meetings;

-- 2. Fix the search_path issues in functions
CREATE OR REPLACE FUNCTION public.user_has_meeting_access(p_meeting_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.update_meeting_shares_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- 3. Create a regular view for accessible meetings (without SECURITY DEFINER)
CREATE VIEW public.accessible_meetings AS
SELECT 
  m.*,
  CASE 
    WHEN m.user_id = auth.uid() THEN 'owner'
    ELSE 'shared'
  END AS access_type,
  ms.shared_by,
  ms.shared_at,
  ms.access_level,
  ms.message AS share_message,
  ms.id AS share_id
FROM public.meetings m
LEFT JOIN public.meeting_shares ms ON m.id = ms.meeting_id
WHERE 
  m.user_id = auth.uid() OR -- Own meetings
  (ms.shared_with_user_id = auth.uid() OR ms.shared_with_email = auth.email()); -- Shared meetings