-- Batch 63: Additional allergies
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('294560006', 'Trimethoprim allergy', 'allergies', 'Drug Allergy'),
('294574002', 'Metronidazole allergy', 'allergies', 'Drug Allergy'),
('294580004', 'Ciprofloxacin allergy', 'allergies', 'Drug Allergy'),
('294590001', 'Clarithromycin allergy', 'allergies', 'Drug Allergy'),
('294600007', 'Doxycycline allergy', 'allergies', 'Drug Allergy'),
('294609008', 'Flucloxacillin allergy', 'allergies', 'Drug Allergy'),
('294615007', 'Cefalexin allergy', 'allergies', 'Drug Allergy'),
('294620001', 'Co-amoxiclav allergy', 'allergies', 'Drug Allergy'),
('293585002', 'Diclofenac allergy', 'allergies', 'Drug Allergy'),
('293592007', 'Naproxen allergy', 'allergies', 'Drug Allergy'),
('294700003', 'ACE inhibitor allergy', 'allergies', 'Drug Allergy'),
('294705008', 'Statin allergy', 'allergies', 'Drug Allergy'),
('294710000', 'Metformin allergy', 'allergies', 'Drug Allergy'),
('294715005', 'Tramadol allergy', 'allergies', 'Drug Allergy'),
('294720009', 'Paracetamol allergy', 'allergies', 'Drug Allergy')
ON CONFLICT (snomed_code) DO NOTHING;