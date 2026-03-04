
-- Create practice_details record for Anita Carter's Brook Health Centre
INSERT INTO public.practice_details (user_id, practice_name, is_default) VALUES
('0f36cc1e-1a4d-43cb-a4d3-6e5a5e799ac0', 'Brook Health Centre', true);

-- Now insert all 37 staff into practice_staff_defaults using the newly created practice_details ID
INSERT INTO public.practice_staff_defaults (practice_id, staff_name, default_email, staff_role, is_active)
SELECT pd.id, v.staff_name, v.default_email, 'Admin Team', true
FROM practice_details pd
CROSS JOIN (VALUES
  ('Anita Carter', 'anita.carter5@nhs.net'),
  ('Arif Supple', 'arif.supple@nhs.net'),
  ('Samreen Arif', 'samreen.arif@nhs.net'),
  ('Clare Turner', 'clare.turner8@nhs.net'),
  ('Dayani Perera', 'dayanitha.perera1@nhs.net'),
  ('Lesley Driscoll', 'lesley.driscoll@nhs.net'),
  ('Theresa Kirkland', 'theresa.kirkland@nhs.net'),
  ('Linda Davidsen', 'linda.davidsen@nhs.net'),
  ('Jackie Bullivant', 'jackie.bullivant@nhs.net'),
  ('Adele Emerson', 'adele.emerson@nhs.net'),
  ('Sarah Mitchell', 'sarah.mitchell22@nhs.net'),
  ('Tracy Marshall', 'tracy.marshall7@nhs.net'),
  ('Kerrie Mortimer', 'kerrie.mortimer@nhs.net'),
  ('Katie Gray', 'k.gray6@nhs.net'),
  ('Colleen Dennis', 'cdennis@nhs.net'),
  ('Hazel Smith', 'hazel.smith15@nhs.net'),
  ('Isla Bridgwood', 'isla.bridgwood@nhs.net'),
  ('Wendy Green', 'wendy.green22@nhs.net'),
  ('Mandy Lowe', 'mandy.lowe10@nhs.net'),
  ('Jackie Palmer', 'jackie.palmer2@nhs.net'),
  ('Kim McKeown', 'kim.mckeown@nhs.net'),
  ('Kate Key', 'kate.key2@nhs.net'),
  ('Lisa Belch', 'lisa.belch@nhs.net'),
  ('Caroline Kirton', 'caroline.kirton@nhs.net'),
  ('Jade Brown', 'jade.brown17@nhs.net'),
  ('Abby Samuel', 'Abby.samuel1@nhs.net'),
  ('Jane Green', 'Jane.green65@nhs.net'),
  ('Tina Mullis', 'tina.mullis@nhs.net'),
  ('Helen De Bono', 'helen.debono@nhs.net'),
  ('Michele Cooper', 'michele.cooper@nhs.net'),
  ('Phoebe Johnson', 'Phoebe.johnson1@nhs.net'),
  ('Parul Ravalia', 'parul.ravlia1@nhs.net'),
  ('Bianca Pahontu', 'bianca.pahontu1@nhs.net'),
  ('Dr P Stevens', 'philip.stevens@nhs.net'),
  ('Dr Afaq Malik', 'afaq.malik@nhs.net'),
  ('Tina Purnell', 'Tina.purnell1@nhs.net'),
  ('Rebecca Evans', 'Rebecca.evans106@nhs.net')
) AS v(staff_name, default_email)
WHERE pd.user_id = '0f36cc1e-1a4d-43cb-a4d3-6e5a5e799ac0' AND pd.practice_name = 'Brook Health Centre';
