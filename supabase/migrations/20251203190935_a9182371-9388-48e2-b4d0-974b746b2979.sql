-- Batch 25: Eye conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('193570009', 'Cataract', 'diagnoses', 'Ophthalmology'),
('23986001', 'Glaucoma', 'diagnoses', 'Ophthalmology'),
('267718000', 'Age-related macular degeneration', 'diagnoses', 'Ophthalmology'),
('4855003', 'Diabetic retinopathy', 'diagnoses', 'Ophthalmology'),
('193219008', 'Retinal detachment', 'diagnoses', 'Ophthalmology'),
('88971006', 'Keratoconus', 'diagnoses', 'Ophthalmology'),
('414941008', 'Dry eye syndrome', 'diagnoses', 'Ophthalmology'),
('307084000', 'Blepharitis', 'diagnoses', 'Ophthalmology'),
('9826008', 'Conjunctivitis', 'diagnoses', 'Ophthalmology'),
('415737009', 'Ocular hypertension', 'diagnoses', 'Ophthalmology'),
('67362008', 'Amblyopia', 'diagnoses', 'Ophthalmology'),
('38101003', 'Strabismus', 'diagnoses', 'Ophthalmology'),
('193731006', 'Optic neuritis', 'diagnoses', 'Ophthalmology'),
('246636008', 'Corneal ulcer', 'diagnoses', 'Ophthalmology'),
('414875008', 'Central retinal vein occlusion', 'diagnoses', 'Ophthalmology')
ON CONFLICT (snomed_code) DO NOTHING;