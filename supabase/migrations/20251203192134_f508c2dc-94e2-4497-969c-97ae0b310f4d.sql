-- Batch 65-70: More conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
-- Peripheral vascular
('399957001', 'Peripheral arterial disease', 'Cardiovascular'),
('233936003', 'Intermittent claudication', 'Cardiovascular'),
('195295006', 'Raynaud phenomenon', 'Cardiovascular'),
('128053003', 'Deep vein thrombosis', 'Cardiovascular'),
('59282003', 'Pulmonary embolism', 'Cardiovascular'),
('439127006', 'Thrombophilia', 'Haematology'),
('234466008', 'Factor V Leiden', 'Haematology'),
('36138009', 'Prothrombin gene mutation', 'Haematology'),
-- Metabolic
('190268003', 'Hyperlipidaemia', 'Metabolic'),
('13644009', 'Hypercholesterolaemia', 'Metabolic'),
('302870006', 'Hypertriglyceridaemia', 'Metabolic'),
('238136002', 'Familial hypercholesterolaemia', 'Metabolic'),
('238131007', 'Overweight', 'Metabolic'),
('414916001', 'Obesity', 'Metabolic'),
('408512008', 'Body mass index 40+', 'Metabolic'),
-- Thyroid additional
('40930008', 'Hypothyroidism', 'Endocrine'),
('34486009', 'Hyperthyroidism', 'Endocrine'),
('21983002', 'Hashimoto thyroiditis', 'Endocrine'),
('353295004', 'Toxic nodular goitre', 'Endocrine'),
('237510001', 'Thyroid nodule', 'Endocrine'),
-- Adrenal
('68588005', 'Addison disease', 'Endocrine'),
('47270006', 'Cushing syndrome', 'Endocrine'),
('26852004', 'Primary hyperaldosteronism', 'Endocrine'),
('85598007', 'Phaeochromocytoma', 'Endocrine'),
('237751000', 'Adrenal incidentaloma', 'Endocrine')
ON CONFLICT (snomed_code) DO NOTHING;