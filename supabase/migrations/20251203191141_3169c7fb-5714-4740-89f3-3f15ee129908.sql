-- Batch 47: Social and lifestyle factors
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('228272008', 'Health problem associated with social care', 'diagnoses', 'Social'),
('365981007', 'Tobacco cessation', 'diagnoses', 'Lifestyle'),
('266919005', 'Never smoked tobacco', 'diagnoses', 'Lifestyle'),
('8517006', 'Ex-smoker', 'diagnoses', 'Lifestyle'),
('65568007', 'Cigarette smoker', 'diagnoses', 'Lifestyle'),
('160573003', 'Heavy alcohol intake', 'diagnoses', 'Lifestyle'),
('228276006', 'Moderate alcohol intake', 'diagnoses', 'Lifestyle'),
('105542008', 'Non-drinker', 'diagnoses', 'Lifestyle'),
('183327006', 'Housing problem', 'diagnoses', 'Social'),
('160933000', 'Lives alone', 'diagnoses', 'Social'),
('224362002', 'Carer', 'diagnoses', 'Social'),
('38628009', 'Regular exercise', 'diagnoses', 'Lifestyle'),
('228423002', 'Sedentary lifestyle', 'diagnoses', 'Lifestyle'),
('160245001', 'Lives in care home', 'diagnoses', 'Social'),
('160756002', 'In sheltered accommodation', 'diagnoses', 'Social')
ON CONFLICT (snomed_code) DO NOTHING;