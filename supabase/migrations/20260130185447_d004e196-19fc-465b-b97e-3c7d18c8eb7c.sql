-- Insert Watlington Medical Centre for test user
INSERT INTO public.gp_practices (practice_code, name, address, phone, organisation_type, ics_code, ics_name)
VALUES (
  'D82043',
  'Watlington Medical Centre',
  'Rowan Close, King''s Lynn, Norfolk, PE33 0TU',
  '01553 810253',
  'GP Practice',
  'QJG',
  'NHS Norfolk and Waveney ICB'
)
ON CONFLICT (practice_code) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  organisation_type = EXCLUDED.organisation_type;