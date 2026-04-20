INSERT INTO public.nres_system_roles (user_email, user_name, role, organisation, is_active)
VALUES
  ('amanda.taylor75@nhs.net', 'Amanda Palin', 'super_admin', 'Brackley & Towcester PCN Ltd', true),
  ('amanda.taylor75@nhs.net', 'Amanda Palin', 'management_lead', 'Brackley & Towcester PCN Ltd', true)
ON CONFLICT (user_email, role) DO UPDATE
  SET is_active = true,
      user_name = EXCLUDED.user_name,
      organisation = EXCLUDED.organisation;