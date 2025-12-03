-- Batch 32: Surgical procedures
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('116783008', 'Hip replacement', 'surgeries', 'Orthopaedic'),
('609588000', 'Knee replacement', 'surgeries', 'Orthopaedic'),
('80146002', 'Appendicectomy', 'surgeries', 'General Surgery'),
('38102005', 'Cholecystectomy', 'surgeries', 'General Surgery'),
('174041007', 'Hernia repair', 'surgeries', 'General Surgery'),
('65200003', 'Coronary artery bypass', 'surgeries', 'Cardiac'),
('18027006', 'Hysterectomy', 'surgeries', 'Gynaecology'),
('64368001', 'Caesarean section', 'surgeries', 'Obstetrics'),
('116028008', 'Mastectomy', 'surgeries', 'General Surgery'),
('116783008', 'Prostatectomy', 'surgeries', 'Urology'),
('81723002', 'Cataract surgery', 'surgeries', 'Ophthalmology'),
('6025007', 'Laparoscopic surgery', 'surgeries', 'General Surgery'),
('307280005', 'Tonsillectomy', 'surgeries', 'ENT'),
('119954001', 'Adenoidectomy', 'surgeries', 'ENT'),
('397956004', 'Thyroidectomy', 'surgeries', 'Endocrine')
ON CONFLICT (snomed_code) DO NOTHING;