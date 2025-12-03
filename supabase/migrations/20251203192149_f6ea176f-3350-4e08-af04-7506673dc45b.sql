-- Batch 77-82: Renal and Neurological
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
-- Renal additional
('129151000119102', 'Chronic kidney disease stage 4', 'Renal'),
('129171000119106', 'Chronic kidney disease stage 5', 'Renal'),
('46177005', 'End-stage renal disease', 'Renal'),
('236425005', 'Chronic kidney disease', 'Renal'),
('197927001', 'Acute kidney injury', 'Renal'),
('90708001', 'Kidney disease', 'Renal'),
('236423003', 'Renal impairment', 'Renal'),
('197480006', 'Polycystic kidney disease', 'Renal'),
('236436003', 'Autosomal dominant polycystic kidney', 'Renal'),
('197756006', 'IgA nephropathy', 'Renal'),
('36171008', 'Glomerulonephritis', 'Renal'),
('197927001', 'Acute renal failure', 'Renal'),
-- Neurological additional
('230690007', 'Cerebrovascular accident', 'Neurological'),
('230698000', 'Lacunar infarction', 'Neurological'),
('195185009', 'Cerebral infarction', 'Neurological'),
('274100004', 'Cerebral haemorrhage', 'Neurological'),
('266257000', 'Transient ischaemic attack', 'Neurological'),
('230745008', 'Hydrocephalus', 'Neurological'),
('387732009', 'Normal pressure hydrocephalus', 'Neurological'),
('230258005', 'Amyotrophic lateral sclerosis', 'Neurological'),
('230270009', 'Motor neurone disease', 'Neurological'),
('128613002', 'Myasthenia gravis', 'Neurological'),
('61462000', 'Malignant neoplasm of brain', 'Oncology'),
('126952004', 'Brain metastases', 'Oncology'),
('416824008', 'Neuroendocrine tumour', 'Oncology')
ON CONFLICT (snomed_code) DO NOTHING;