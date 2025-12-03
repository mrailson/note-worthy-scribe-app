-- Batch 34: Immunisations
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('871875004', 'Influenza vaccination', 'immunisations', 'Immunisation'),
('1157024006', 'COVID-19 vaccination', 'immunisations', 'Immunisation'),
('871751006', 'Pneumococcal vaccination', 'immunisations', 'Immunisation'),
('871803007', 'Hepatitis B vaccination', 'immunisations', 'Immunisation'),
('871822003', 'MMR vaccination', 'immunisations', 'Immunisation'),
('871839001', 'DTaP vaccination', 'immunisations', 'Immunisation'),
('871878002', 'Shingles vaccination', 'immunisations', 'Immunisation'),
('871919004', 'Tetanus vaccination', 'immunisations', 'Immunisation'),
('871921009', 'Polio vaccination', 'immunisations', 'Immunisation'),
('871765008', 'BCG vaccination', 'immunisations', 'Immunisation'),
('871726005', 'Meningitis B vaccination', 'immunisations', 'Immunisation'),
('871738001', 'Meningitis ACWY vaccination', 'immunisations', 'Immunisation'),
('871804001', 'HPV vaccination', 'immunisations', 'Immunisation'),
('871837004', 'Rotavirus vaccination', 'immunisations', 'Immunisation'),
('871866001', 'Hepatitis A vaccination', 'immunisations', 'Immunisation')
ON CONFLICT (snomed_code) DO NOTHING;