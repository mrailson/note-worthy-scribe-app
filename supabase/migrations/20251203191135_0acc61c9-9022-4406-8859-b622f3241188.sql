-- Batch 45: Respiratory conditions expanded
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('233703007', 'Interstitial lung disease', 'diagnoses', 'Respiratory'),
('51615001', 'Idiopathic pulmonary fibrosis', 'diagnoses', 'Respiratory'),
('233604007', 'Bronchiectasis', 'diagnoses', 'Respiratory'),
('40100001', 'Sarcoidosis', 'diagnoses', 'Respiratory'),
('70995007', 'Pulmonary hypertension', 'diagnoses', 'Respiratory'),
('233678006', 'Pneumothorax', 'diagnoses', 'Respiratory'),
('233695001', 'Pleural effusion', 'diagnoses', 'Respiratory'),
('2912004', 'Empyema', 'diagnoses', 'Respiratory'),
('254637007', 'Mesothelioma', 'diagnoses', 'Respiratory'),
('195967001', 'Allergic bronchopulmonary aspergillosis', 'diagnoses', 'Respiratory'),
('195517003', 'Acute bronchitis', 'diagnoses', 'Respiratory'),
('233604007', 'Acute exacerbation of COPD', 'diagnoses', 'Respiratory'),
('389087006', 'Hypersensitivity pneumonitis', 'diagnoses', 'Respiratory'),
('56717001', 'Pulmonary tuberculosis', 'diagnoses', 'Respiratory'),
('46239001', 'Occupational lung disease', 'diagnoses', 'Respiratory')
ON CONFLICT (snomed_code) DO NOTHING;