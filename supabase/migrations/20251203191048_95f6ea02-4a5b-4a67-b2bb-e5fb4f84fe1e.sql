-- Batch 38: Neurological conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('193462001', 'Tension headache', 'diagnoses', 'Neurology'),
('4556007', 'Gastroesophageal reflux', 'diagnoses', 'Gastroenterology'),
('267102003', 'Carpal tunnel syndrome', 'diagnoses', 'Neurology'),
('398100001', 'Motor neurone disease', 'diagnoses', 'Neurology'),
('69896004', 'Myasthenia gravis', 'diagnoses', 'Neurology'),
('302227003', 'Trigeminal neuralgia', 'diagnoses', 'Neurology'),
('26929004', 'Alzheimer disease', 'diagnoses', 'Neurology'),
('52448006', 'Vascular dementia', 'diagnoses', 'Neurology'),
('312991009', 'Lewy body dementia', 'diagnoses', 'Neurology'),
('230267005', 'Frontotemporal dementia', 'diagnoses', 'Neurology'),
('128187005', 'Huntington disease', 'diagnoses', 'Neurology'),
('60389000', 'Spinal muscular atrophy', 'diagnoses', 'Neurology'),
('3716002', 'Guillain-Barre syndrome', 'diagnoses', 'Neurology'),
('182566003', 'Restless leg syndrome', 'diagnoses', 'Neurology'),
('37796009', 'Peripheral neuropathy', 'diagnoses', 'Neurology')
ON CONFLICT (snomed_code) DO NOTHING;