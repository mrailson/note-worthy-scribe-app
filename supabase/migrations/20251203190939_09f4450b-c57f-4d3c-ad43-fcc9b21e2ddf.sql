-- Batch 26: ENT conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('65363002', 'Otitis media', 'diagnoses', 'ENT'),
('300228004', 'Hearing loss', 'diagnoses', 'ENT'),
('103298005', 'Tinnitus', 'diagnoses', 'ENT'),
('13445001', 'Vertigo', 'diagnoses', 'ENT'),
('399357009', 'Meniere disease', 'diagnoses', 'ENT'),
('65619004', 'Sinusitis', 'diagnoses', 'ENT'),
('90560007', 'Allergic rhinitis', 'diagnoses', 'ENT'),
('232347008', 'Nasal polyps', 'diagnoses', 'ENT'),
('126664009', 'Epistaxis', 'diagnoses', 'ENT'),
('78275009', 'Obstructive sleep apnoea', 'diagnoses', 'ENT'),
('232396003', 'Laryngitis', 'diagnoses', 'ENT'),
('17741008', 'Tonsillitis', 'diagnoses', 'ENT'),
('44054006', 'Diabetes mellitus type 2', 'diagnoses', 'Endocrine'),
('302866003', 'Labyrinthitis', 'diagnoses', 'ENT'),
('422504002', 'Anosmia', 'diagnoses', 'ENT')
ON CONFLICT (snomed_code) DO NOTHING;