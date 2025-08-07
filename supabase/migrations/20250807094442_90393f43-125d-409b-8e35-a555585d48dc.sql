-- Update ALL user_roles records for the specific user to remove Replywell access
UPDATE public.user_roles 
SET replywell_access = false
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';