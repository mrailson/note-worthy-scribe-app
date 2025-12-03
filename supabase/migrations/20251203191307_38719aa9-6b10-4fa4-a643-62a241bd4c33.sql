-- Batch 62: Additional immunisations
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('871761008', 'Typhoid vaccination', 'immunisations', 'Travel Immunisation'),
('871758002', 'Cholera vaccination', 'immunisations', 'Travel Immunisation'),
('871724008', 'Yellow fever vaccination', 'immunisations', 'Travel Immunisation'),
('871867005', 'Rabies vaccination', 'immunisations', 'Travel Immunisation'),
('871772009', 'Japanese encephalitis vaccination', 'immunisations', 'Travel Immunisation'),
('871866001', 'Tick-borne encephalitis vaccination', 'immunisations', 'Travel Immunisation'),
('871738001', 'Meningococcal vaccination', 'immunisations', 'Travel Immunisation'),
('871919004', 'Diphtheria vaccination', 'immunisations', 'Immunisation'),
('871726005', 'Haemophilus influenzae vaccination', 'immunisations', 'Immunisation'),
('871875004', 'Quadrivalent influenza vaccination', 'immunisations', 'Immunisation'),
('1157024006', 'Pfizer COVID-19 vaccination', 'immunisations', 'COVID Immunisation'),
('1157024006', 'AstraZeneca COVID-19 vaccination', 'immunisations', 'COVID Immunisation'),
('1157024006', 'Moderna COVID-19 vaccination', 'immunisations', 'COVID Immunisation'),
('871878002', 'Shingrix vaccination', 'immunisations', 'Immunisation'),
('871751006', 'Pneumovax vaccination', 'immunisations', 'Immunisation')
ON CONFLICT (snomed_code) DO NOTHING;