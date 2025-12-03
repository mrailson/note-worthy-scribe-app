-- Batch 43: More cardiac conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('233817007', 'Aortic stenosis', 'diagnoses', 'Cardiology'),
('427004003', 'Aortic regurgitation', 'diagnoses', 'Cardiology'),
('79619009', 'Mitral stenosis', 'diagnoses', 'Cardiology'),
('48724000', 'Mitral regurgitation', 'diagnoses', 'Cardiology'),
('79091001', 'Tricuspid regurgitation', 'diagnoses', 'Cardiology'),
('233846001', 'Pulmonary stenosis', 'diagnoses', 'Cardiology'),
('233848000', 'Aortic aneurysm', 'diagnoses', 'Cardiology'),
('67362008', 'Aortic dissection', 'diagnoses', 'Cardiology'),
('399957001', 'Peripheral arterial disease', 'diagnoses', 'Vascular'),
('128053003', 'Carotid artery stenosis', 'diagnoses', 'Vascular'),
('234162006', 'Hypertrophic cardiomyopathy', 'diagnoses', 'Cardiology'),
('415295002', 'Dilated cardiomyopathy', 'diagnoses', 'Cardiology'),
('399020009', 'Restrictive cardiomyopathy', 'diagnoses', 'Cardiology'),
('50570003', 'Arrhythmogenic right ventricular cardiomyopathy', 'diagnoses', 'Cardiology'),
('25569003', 'Takotsubo cardiomyopathy', 'diagnoses', 'Cardiology')
ON CONFLICT (snomed_code) DO NOTHING;