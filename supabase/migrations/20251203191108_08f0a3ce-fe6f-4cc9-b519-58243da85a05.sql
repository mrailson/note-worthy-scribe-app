-- Batch 42: Endocrine conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('237602007', 'Metabolic syndrome', 'diagnoses', 'Endocrine'),
('190268003', 'Cushing syndrome', 'diagnoses', 'Endocrine'),
('237662000', 'Addison disease', 'diagnoses', 'Endocrine'),
('56232006', 'Hyperparathyroidism', 'diagnoses', 'Endocrine'),
('36976004', 'Hypoparathyroidism', 'diagnoses', 'Endocrine'),
('34713006', 'Vitamin D deficiency', 'diagnoses', 'Endocrine'),
('237872002', 'Pituitary adenoma', 'diagnoses', 'Endocrine'),
('84172003', 'Acromegaly', 'diagnoses', 'Endocrine'),
('51500006', 'Hypopituitarism', 'diagnoses', 'Endocrine'),
('237871009', 'Prolactinoma', 'diagnoses', 'Endocrine'),
('7200002', 'Primary aldosteronism', 'diagnoses', 'Endocrine'),
('190406000', 'Phaeochromocytoma', 'diagnoses', 'Endocrine'),
('54823002', 'Subclinical hypothyroidism', 'diagnoses', 'Endocrine'),
('14304000', 'Thyroid nodule', 'diagnoses', 'Endocrine'),
('237613005', 'Hyperthyroid crisis', 'diagnoses', 'Endocrine')
ON CONFLICT (snomed_code) DO NOTHING;