-- Batch 58: Autoimmune conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('31996006', 'Giant cell arteritis', 'diagnoses', 'Autoimmune'),
('239946004', 'Takayasu arteritis', 'diagnoses', 'Autoimmune'),
('396332003', 'Mixed connective tissue disease', 'diagnoses', 'Autoimmune'),
('71353005', 'Scleroderma', 'diagnoses', 'Autoimmune'),
('31681005', 'CREST syndrome', 'diagnoses', 'Autoimmune'),
('56717001', 'Behcet disease', 'diagnoses', 'Autoimmune'),
('36070007', 'Polyarteritis nodosa', 'diagnoses', 'Autoimmune'),
('31611000', 'Granulomatosis with polyangiitis', 'diagnoses', 'Autoimmune'),
('239930000', 'Eosinophilic granulomatosis with polyangiitis', 'diagnoses', 'Autoimmune'),
('36138009', 'Microscopic polyangiitis', 'diagnoses', 'Autoimmune'),
('15737005', 'Goodpasture syndrome', 'diagnoses', 'Autoimmune'),
('86555001', 'Hashimoto thyroiditis', 'diagnoses', 'Autoimmune'),
('14304000', 'Graves disease', 'diagnoses', 'Autoimmune'),
('396229005', 'Autoimmune gastritis', 'diagnoses', 'Autoimmune'),
('128302006', 'Type 1 diabetes mellitus', 'diagnoses', 'Autoimmune')
ON CONFLICT (snomed_code) DO NOTHING;