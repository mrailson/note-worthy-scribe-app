-- Batch 101-106: Haematological malignancies and conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
-- Leukaemias
('91855006', 'Acute lymphoblastic leukaemia', 'Haematology'),
('91857003', 'Acute myeloid leukaemia', 'Haematology'),
('92814006', 'Chronic lymphocytic leukaemia', 'Haematology'),
('92818009', 'Chronic myeloid leukaemia', 'Haematology'),
('109989006', 'Myelodysplastic syndrome', 'Haematology'),
('128621006', 'Myeloproliferative disorder', 'Haematology'),
('109994006', 'Polycythaemia vera', 'Haematology'),
('128614008', 'Essential thrombocythaemia', 'Haematology'),
('307592006', 'Primary myelofibrosis', 'Haematology'),
-- Lymphomas
('118600007', 'Hodgkin lymphoma', 'Haematology'),
('118601006', 'Non-Hodgkin lymphoma', 'Haematology'),
('109972003', 'Diffuse large B-cell lymphoma', 'Haematology'),
('109966008', 'Follicular lymphoma', 'Haematology'),
('109976000', 'Mantle cell lymphoma', 'Haematology'),
('109979007', 'Marginal zone lymphoma', 'Haematology'),
('109987003', 'Burkitt lymphoma', 'Haematology'),
('109968009', 'Cutaneous T-cell lymphoma', 'Haematology'),
-- Multiple myeloma
('109989006', 'Multiple myeloma', 'Haematology'),
('277577000', 'Monoclonal gammopathy', 'Haematology'),
('109981009', 'Waldenstrom macroglobulinaemia', 'Haematology'),
-- Other haematology
('40108008', 'Aplastic anaemia', 'Haematology'),
('127034005', 'Pancytopenia', 'Haematology'),
('74576004', 'Acquired haemolytic anaemia', 'Haematology'),
('36070007', 'Autoimmune haemolytic anaemia', 'Haematology'),
('302215000', 'Thrombocytopenic purpura', 'Haematology')
ON CONFLICT (snomed_code) DO NOTHING;