-- Batch 27: Haematological conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('87522002', 'Iron deficiency anaemia', 'diagnoses', 'Haematology'),
('109989006', 'Vitamin B12 deficiency anaemia', 'diagnoses', 'Haematology'),
('127040003', 'Sickle cell anaemia', 'diagnoses', 'Haematology'),
('40108008', 'Thalassaemia', 'diagnoses', 'Haematology'),
('93143009', 'Leukaemia', 'diagnoses', 'Haematology'),
('118600007', 'Lymphoma', 'diagnoses', 'Haematology'),
('109989006', 'Myeloma', 'diagnoses', 'Haematology'),
('302215000', 'Thrombocytopenia', 'diagnoses', 'Haematology'),
('64779008', 'Haemophilia', 'diagnoses', 'Haematology'),
('441882002', 'Von Willebrand disease', 'diagnoses', 'Haematology'),
('61261009', 'Polycythaemia vera', 'diagnoses', 'Haematology'),
('128611004', 'Thrombophilia', 'diagnoses', 'Haematology'),
('234466008', 'Factor V Leiden', 'diagnoses', 'Haematology'),
('128105004', 'Deep vein thrombosis', 'diagnoses', 'Haematology'),
('59282003', 'Pulmonary embolism', 'diagnoses', 'Haematology')
ON CONFLICT (snomed_code) DO NOTHING;