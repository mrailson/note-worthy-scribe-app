-- Final 35 codes to reach ~3,500 target
INSERT INTO public.snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
-- Mental health
('35489007', 'Depressive disorder', 'diagnoses', 'Mental health'),
('197480006', 'Anxiety disorder', 'diagnoses', 'Mental health'),
('58214004', 'Schizophrenia', 'diagnoses', 'Mental health'),
('13746004', 'Bipolar disorder', 'diagnoses', 'Mental health'),
('44376007', 'Post-traumatic stress disorder', 'diagnoses', 'Mental health'),
('72366004', 'Eating disorder', 'diagnoses', 'Mental health'),
('191667009', 'Obsessive compulsive disorder', 'diagnoses', 'Mental health'),
-- Musculoskeletal
('69896004', 'Rheumatoid arthritis', 'diagnoses', 'Musculoskeletal'),
('396275006', 'Osteoarthritis', 'diagnoses', 'Musculoskeletal'),
('64859006', 'Osteoporosis', 'diagnoses', 'Musculoskeletal'),
('203082005', 'Fibromyalgia', 'diagnoses', 'Musculoskeletal'),
('24484000', 'Gout', 'diagnoses', 'Musculoskeletal'),
('55822004', 'Hyperlipidemia', 'diagnoses', 'Metabolic'),
-- Renal
('709044004', 'Chronic kidney disease', 'diagnoses', 'Renal'),
('236425005', 'Chronic kidney disease stage 3', 'diagnoses', 'Renal'),
('431856006', 'Chronic kidney disease stage 4', 'diagnoses', 'Renal'),
('433146000', 'Chronic kidney disease stage 5', 'diagnoses', 'Renal'),
('431857002', 'Chronic kidney disease stage 3A', 'diagnoses', 'Renal'),
('431855005', 'Chronic kidney disease stage 3B', 'diagnoses', 'Renal'),
-- Haematological
('271737000', 'Anaemia', 'diagnoses', 'Haematological'),
('87522002', 'Iron deficiency anaemia', 'diagnoses', 'Haematological'),
('234349001', 'Vitamin B12 deficiency anaemia', 'diagnoses', 'Haematological'),
-- Dermatological
('200773006', 'Psoriasis', 'diagnoses', 'Dermatological'),
('24079001', 'Atopic dermatitis', 'diagnoses', 'Dermatological'),
('402408009', 'Acne vulgaris', 'diagnoses', 'Dermatological'),
-- Ophthalmological
('193570009', 'Cataract', 'diagnoses', 'Ophthalmological'),
('77075001', 'Primary open angle glaucoma', 'diagnoses', 'Ophthalmological'),
('267718000', 'Age-related macular degeneration', 'diagnoses', 'Ophthalmological'),
-- Infectious
('186747009', 'Coronavirus infection', 'diagnoses', 'Infectious'),
('840539006', 'COVID-19', 'diagnoses', 'Infectious'),
-- Immunisations
('1119349007', 'COVID-19 vaccination', 'immunisations', 'Immunisation'),
('836374004', 'Hepatitis B vaccination', 'immunisations', 'Immunisation'),
('836377006', 'Tetanus vaccination', 'immunisations', 'Immunisation'),
('836398006', 'Pneumococcal vaccination', 'immunisations', 'Immunisation'),
('836375003', 'Hepatitis A vaccination', 'immunisations', 'Immunisation')
ON CONFLICT (snomed_code) DO NOTHING;