-- Add module access columns to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN meeting_notes_access boolean DEFAULT true,
ADD COLUMN gp_scribe_access boolean DEFAULT false,
ADD COLUMN complaints_manager_access boolean DEFAULT false,
ADD COLUMN complaints_admin_access boolean DEFAULT false,
ADD COLUMN replywell_access boolean DEFAULT false;