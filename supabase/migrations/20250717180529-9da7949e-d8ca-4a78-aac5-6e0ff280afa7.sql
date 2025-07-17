-- Insert Banbury Cross Health Centre into gp_practices table
INSERT INTO public.gp_practices (
  practice_code,
  name,
  organisation_type,
  ics_name,
  ics_code,
  pcn_code
) VALUES (
  'M85001',  -- Standard NHS practice code format for Banbury area
  'Banbury Cross Health Centre',
  'GP Practice',
  'Buckinghamshire, Oxfordshire and Berkshire West ICB',
  'BOB',
  NULL  -- PCN code not specified
);