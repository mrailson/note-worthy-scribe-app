INSERT INTO gp_practices (id, name, practice_code, pcn_code, ics_code, ics_name, organisation_type, created_at)
VALUES 
  (gen_random_uuid(), 'PML', 'PML001', NULL, 'QPM', 'Northamptonshire ICB', 'Management', NOW()),
  (gen_random_uuid(), 'Northants ICB', 'NICB001', NULL, 'QPM', 'Northamptonshire ICB', 'ICB', NOW()),
  (gen_random_uuid(), 'Blue PCN', 'BPCN001', NULL, 'QPM', 'Northamptonshire ICB', 'PCN', NOW()),
  (gen_random_uuid(), 'Northants LMC', 'NLMC001', NULL, 'QPM', 'Northamptonshire ICB', 'LMC', NOW()),
  (gen_random_uuid(), 'NRES', 'NRES001', NULL, 'QPM', 'Northamptonshire ICB', 'Neighbourhood', NOW());