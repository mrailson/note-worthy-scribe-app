-- Batch 119-124: Ophthalmology and ENT
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
-- Ophthalmology
('193570009', 'Cataract', 'Ophthalmology'),
('193569008', 'Age-related cataract', 'Ophthalmology'),
('23986001', 'Glaucoma', 'Ophthalmology'),
('77075001', 'Primary open angle glaucoma', 'Ophthalmology'),
('392288006', 'Primary angle closure glaucoma', 'Ophthalmology'),
('232025008', 'Age-related macular degeneration', 'Ophthalmology'),
('267718000', 'Wet age-related macular degeneration', 'Ophthalmology'),
('247167008', 'Dry age-related macular degeneration', 'Ophthalmology'),
('4855003', 'Diabetic retinopathy', 'Ophthalmology'),
('312912001', 'Background diabetic retinopathy', 'Ophthalmology'),
('312903003', 'Proliferative diabetic retinopathy', 'Ophthalmology'),
('232020009', 'Diabetic macular oedema', 'Ophthalmology'),
('41446000', 'Blepharitis', 'Ophthalmology'),
('9826008', 'Conjunctivitis', 'Ophthalmology'),
('414875008', 'Dry eye syndrome', 'Ophthalmology'),
-- ENT
('80602006', 'Chronic otitis media', 'ENT'),
('194540004', 'Otosclerosis', 'ENT'),
('60862001', 'Tinnitus', 'ENT'),
('271756001', 'Presbyacusis', 'ENT'),
('15188001', 'Hearing loss', 'ENT'),
('95820000', 'Bilateral sensorineural deafness', 'ENT'),
('194278007', 'Chronic sinusitis', 'ENT'),
('267102003', 'Nasal polyp', 'ENT'),
('118940003', 'Deviated nasal septum', 'ENT'),
('363696006', 'Laryngeal carcinoma', 'Oncology')
ON CONFLICT (snomed_code) DO NOTHING;