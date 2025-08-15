-- Restore system admin role for malcolm.railson@nhs.net
INSERT INTO public.user_roles (user_id, role, assigned_by, assigned_at)
VALUES (
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'system_admin',
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  NOW()
);