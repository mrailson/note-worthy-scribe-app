-- Import known NRES team members as board members
-- Using a system user_id placeholder that will be updated by application
INSERT INTO public.nres_board_members (user_id, name, role, group_name, email, is_active)
SELECT 
  (SELECT id FROM auth.users LIMIT 1) as user_id,
  name,
  role,
  group_name,
  email,
  true as is_active
FROM (VALUES
  ('Dr Mark Gray', 'PML Representative', 'Clinical', 'mark.gray1@nhs.net'),
  ('Dr Julia Railson', 'GP Partner', 'Clinical', 'j.railson@nhs.net'),
  ('Dr Simon Ellis', 'Clinical Director, Brackley & Towcester PCN', 'Clinical', 'simon.ellis7@nhs.net'),
  ('Dr Tom Howseman', 'PCN Clinical Director', 'Clinical', 'tom.howseman@nhs.net'),
  ('Sarah Berry', 'Practice Manager', 'Management', 'sarah.berry17@nhs.net'),
  ('Malcolm Railson', 'PCN Manager', 'Management', 'malcolm.railson@nhs.net'),
  ('Amanda Taylor', 'PCN Operations Manager', 'Management', 'amanda.taylor75@nhs.net'),
  ('Claire Curley', 'PCN Manager', 'Management', 'claire.curley@nhs.net'),
  ('Lucy Hibberd', 'Administrator', 'Admin', 'lucy.hibberd@nhs.net'),
  ('Carolyn Abbisogni', 'PML Representative', 'External', 'carolyn.abbisogni@nhs.net'),
  ('Ellie Wagg', 'ICB Representative', 'External', 'ellie.wagg@nhs.net'),
  ('Hannah Scanlon', 'LMC Representative', 'External', 'hannah.scanlon@nhs.net'),
  ('Janice Benham', 'LMC Representative', 'External', 'janice.benham@nhs.net'),
  ('Colin Smith', 'LMC Representative', 'External', 'colin.smith24@nhs.net'),
  ('Hayley Willingham', 'Springfield Surgery', 'External', 'hayley.willingham1@nhs.net')
) AS t(name, role, group_name, email)
WHERE NOT EXISTS (
  SELECT 1 FROM public.nres_board_members WHERE nres_board_members.email = t.email
);