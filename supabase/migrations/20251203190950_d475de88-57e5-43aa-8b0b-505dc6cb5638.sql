-- Batch 28: Infectious diseases
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('840539006', 'COVID-19', 'diagnoses', 'Infectious Disease'),
('6142004', 'Influenza', 'diagnoses', 'Infectious Disease'),
('186431008', 'HIV infection', 'diagnoses', 'Infectious Disease'),
('40468003', 'Hepatitis A', 'diagnoses', 'Infectious Disease'),
('66071002', 'Hepatitis B', 'diagnoses', 'Infectious Disease'),
('50711007', 'Hepatitis C', 'diagnoses', 'Infectious Disease'),
('56717001', 'Tuberculosis', 'diagnoses', 'Infectious Disease'),
('186788009', 'Lyme disease', 'diagnoses', 'Infectious Disease'),
('240532009', 'Human papillomavirus infection', 'diagnoses', 'Infectious Disease'),
('27836007', 'Pertussis', 'diagnoses', 'Infectious Disease'),
('38907003', 'Varicella', 'diagnoses', 'Infectious Disease'),
('36989005', 'Mumps', 'diagnoses', 'Infectious Disease'),
('14189004', 'Measles', 'diagnoses', 'Infectious Disease'),
('36653000', 'Rubella', 'diagnoses', 'Infectious Disease'),
('186747009', 'Norovirus infection', 'diagnoses', 'Infectious Disease')
ON CONFLICT (snomed_code) DO NOTHING;