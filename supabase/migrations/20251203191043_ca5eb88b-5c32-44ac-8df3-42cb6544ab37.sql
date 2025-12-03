-- Batch 37: Oncology
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('93880001', 'Lung cancer', 'diagnoses', 'Oncology'),
('363406005', 'Colorectal cancer', 'diagnoses', 'Oncology'),
('126906006', 'Gastric cancer', 'diagnoses', 'Oncology'),
('363358000', 'Pancreatic cancer', 'diagnoses', 'Oncology'),
('363418001', 'Bladder cancer', 'diagnoses', 'Oncology'),
('126485001', 'Oesophageal cancer', 'diagnoses', 'Oncology'),
('93655004', 'Brain tumour', 'diagnoses', 'Oncology'),
('372130007', 'Hepatocellular carcinoma', 'diagnoses', 'Oncology'),
('94225005', 'Cervical cancer', 'diagnoses', 'Oncology'),
('254837009', 'Endometrial cancer', 'diagnoses', 'Oncology'),
('363392001', 'Renal cell carcinoma', 'diagnoses', 'Oncology'),
('363449006', 'Thyroid cancer', 'diagnoses', 'Oncology'),
('93143009', 'Acute lymphoblastic leukaemia', 'diagnoses', 'Oncology'),
('188725004', 'Chronic lymphocytic leukaemia', 'diagnoses', 'Oncology'),
('109989006', 'Multiple myeloma', 'diagnoses', 'Oncology')
ON CONFLICT (snomed_code) DO NOTHING;