-- Batch 36: More allergies and intolerances
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('419474003', 'Cat dander allergy', 'allergies', 'Environmental Allergy'),
('232350006', 'Dog dander allergy', 'allergies', 'Environmental Allergy'),
('418634005', 'Grass pollen allergy', 'allergies', 'Environmental Allergy'),
('418104001', 'Tree pollen allergy', 'allergies', 'Environmental Allergy'),
('294530008', 'Codeine allergy', 'allergies', 'Drug Allergy'),
('294534004', 'Morphine allergy', 'allergies', 'Drug Allergy'),
('293584003', 'NSAID allergy', 'allergies', 'Drug Allergy'),
('294851007', 'Erythromycin allergy', 'allergies', 'Drug Allergy'),
('418471000', 'Contrast media allergy', 'allergies', 'Drug Allergy'),
('419199007', 'Bee venom allergy', 'allergies', 'Environmental Allergy'),
('419263009', 'Wasp venom allergy', 'allergies', 'Environmental Allergy'),
('232347008', 'Sesame allergy', 'allergies', 'Food Allergy'),
('418184004', 'Celery allergy', 'allergies', 'Food Allergy'),
('419573003', 'Mustard allergy', 'allergies', 'Food Allergy'),
('267425008', 'Lactose intolerance', 'allergies', 'Food Intolerance')
ON CONFLICT (snomed_code) DO NOTHING;