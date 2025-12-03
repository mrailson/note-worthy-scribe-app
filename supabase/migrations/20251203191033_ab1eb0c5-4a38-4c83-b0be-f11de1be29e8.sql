-- Batch 35: Allergies
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('91936005', 'Penicillin allergy', 'allergies', 'Drug Allergy'),
('294505008', 'Amoxicillin allergy', 'allergies', 'Drug Allergy'),
('293963007', 'Aspirin allergy', 'allergies', 'Drug Allergy'),
('293586001', 'Ibuprofen allergy', 'allergies', 'Drug Allergy'),
('418038007', 'Sulfonamide allergy', 'allergies', 'Drug Allergy'),
('416098002', 'Latex allergy', 'allergies', 'Environmental Allergy'),
('300913006', 'Peanut allergy', 'allergies', 'Food Allergy'),
('91935009', 'Tree nut allergy', 'allergies', 'Food Allergy'),
('91930004', 'Egg allergy', 'allergies', 'Food Allergy'),
('782555009', 'Milk allergy', 'allergies', 'Food Allergy'),
('300916003', 'Wheat allergy', 'allergies', 'Food Allergy'),
('418689008', 'Shellfish allergy', 'allergies', 'Food Allergy'),
('300910009', 'Fish allergy', 'allergies', 'Food Allergy'),
('91934008', 'Soya allergy', 'allergies', 'Food Allergy'),
('419199007', 'House dust mite allergy', 'allergies', 'Environmental Allergy')
ON CONFLICT (snomed_code) DO NOTHING;