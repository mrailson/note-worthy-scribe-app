-- Batch 41: Renal and urological conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('431855005', 'Chronic kidney disease stage 1', 'diagnoses', 'Nephrology'),
('431856006', 'Chronic kidney disease stage 2', 'diagnoses', 'Nephrology'),
('433144002', 'Chronic kidney disease stage 3', 'diagnoses', 'Nephrology'),
('431857002', 'Chronic kidney disease stage 4', 'diagnoses', 'Nephrology'),
('433146000', 'Chronic kidney disease stage 5', 'diagnoses', 'Nephrology'),
('197927001', 'Nephrotic syndrome', 'diagnoses', 'Nephrology'),
('236423003', 'IgA nephropathy', 'diagnoses', 'Nephrology'),
('266569009', 'Polycystic kidney disease', 'diagnoses', 'Nephrology'),
('236639009', 'Renal artery stenosis', 'diagnoses', 'Nephrology'),
('14669001', 'Acute kidney injury', 'diagnoses', 'Nephrology'),
('197480006', 'Urinary tract infection', 'diagnoses', 'Urology'),
('45816000', 'Pyelonephritis', 'diagnoses', 'Urology'),
('70650003', 'Urinary retention', 'diagnoses', 'Urology'),
('68566005', 'Urinary incontinence', 'diagnoses', 'Urology'),
('67909002', 'Overactive bladder', 'diagnoses', 'Urology')
ON CONFLICT (snomed_code) DO NOTHING;