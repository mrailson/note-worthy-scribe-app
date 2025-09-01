-- Assign Malcolm Railson to Oak Lane Medical Practice as practice manager
-- This preserves their existing system_admin role while adding practice access
INSERT INTO public.user_roles (user_id, practice_id, role, assigned_by) 
VALUES ('e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid, 'c800c954-3928-4a37-a5c4-c4ff3e680333'::uuid, 'practice_manager'::app_role, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid)
ON CONFLICT (user_id, practice_id, role) DO NOTHING;