-- Batch 61: Dental and oral conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('80967001', 'Dental caries', 'diagnoses', 'Dental'),
('27355003', 'Periodontal disease', 'diagnoses', 'Dental'),
('66383009', 'Gingivitis', 'diagnoses', 'Dental'),
('109564008', 'Dental abscess', 'diagnoses', 'Dental'),
('196374005', 'Oral candidiasis', 'diagnoses', 'Dental'),
('5765000', 'Oral lichen planus', 'diagnoses', 'Dental'),
('26284000', 'Aphthous ulcer', 'diagnoses', 'Dental'),
('109380009', 'Leukoplakia of oral mucosa', 'diagnoses', 'Dental'),
('109381008', 'Oral erythroplakia', 'diagnoses', 'Dental'),
('363508007', 'Oral squamous cell carcinoma', 'diagnoses', 'Dental'),
('90584004', 'Temporomandibular joint disorder', 'diagnoses', 'Dental'),
('109380009', 'Bruxism', 'diagnoses', 'Dental'),
('82868003', 'Sialadenitis', 'diagnoses', 'Dental'),
('111321008', 'Sialolithiasis', 'diagnoses', 'Dental'),
('3644008', 'Xerostomia', 'diagnoses', 'Dental')
ON CONFLICT (snomed_code) DO NOTHING;