-- Batch 57: Blood and clotting disorders
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('234467004', 'Prothrombin gene mutation', 'diagnoses', 'Haematology'),
('72962008', 'Antiphospholipid syndrome', 'diagnoses', 'Haematology'),
('78129009', 'Protein C deficiency', 'diagnoses', 'Haematology'),
('61937009', 'Protein S deficiency', 'diagnoses', 'Haematology'),
('31541003', 'Antithrombin deficiency', 'diagnoses', 'Haematology'),
('36070007', 'Aplastic anaemia', 'diagnoses', 'Haematology'),
('109991008', 'Myelodysplastic syndrome', 'diagnoses', 'Haematology'),
('109962001', 'Primary myelofibrosis', 'diagnoses', 'Haematology'),
('34397007', 'Essential thrombocythaemia', 'diagnoses', 'Haematology'),
('40930008', 'Haemolytic anaemia', 'diagnoses', 'Haematology'),
('363349007', 'Idiopathic thrombocytopenic purpura', 'diagnoses', 'Haematology'),
('62479008', 'Hereditary spherocytosis', 'diagnoses', 'Haematology'),
('386736001', 'G6PD deficiency', 'diagnoses', 'Haematology'),
('36070007', 'Pernicious anaemia', 'diagnoses', 'Haematology'),
('49708008', 'Folate deficiency anaemia', 'diagnoses', 'Haematology')
ON CONFLICT (snomed_code) DO NOTHING;