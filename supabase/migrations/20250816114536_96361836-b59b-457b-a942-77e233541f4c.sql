-- Restore system admin access for the user
INSERT INTO public.user_roles (user_id, role, assigned_by, assigned_at)
VALUES ('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'system_admin', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', now());

-- Also restore practice manager role for the Oak Lane Medical Practice
INSERT INTO public.user_roles (user_id, role, practice_id, assigned_by, assigned_at)
VALUES (
  'e3aea82f-451b-40fb-8681-2b579a92dc3a', 
  'practice_manager', 
  'c800c954-3928-4a37-a5c4-c4ff3e680333',
  'e3aea82f-451b-40fb-8681-2b579a92dc3a', 
  now()
);