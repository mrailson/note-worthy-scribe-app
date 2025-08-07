-- Remove Replywell access for current user
UPDATE public.user_roles 
SET replywell_access = false
WHERE user_id = auth.uid();