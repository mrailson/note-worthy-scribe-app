-- Batch 31: Paediatric conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('87433001', 'Autistic spectrum disorder', 'diagnoses', 'Paediatrics'),
('406506008', 'ADHD', 'diagnoses', 'Paediatrics'),
('230690007', 'Cerebral palsy', 'diagnoses', 'Paediatrics'),
('73211009', 'Down syndrome', 'diagnoses', 'Paediatrics'),
('205615000', 'Congenital heart disease', 'diagnoses', 'Paediatrics'),
('13213009', 'Spina bifida', 'diagnoses', 'Paediatrics'),
('205295000', 'Cystic fibrosis', 'diagnoses', 'Paediatrics'),
('127529005', 'Duchenne muscular dystrophy', 'diagnoses', 'Paediatrics'),
('77480004', 'Congenital hip dysplasia', 'diagnoses', 'Paediatrics'),
('30760008', 'Talipes equinovarus', 'diagnoses', 'Paediatrics'),
('95315002', 'Childhood asthma', 'diagnoses', 'Paediatrics'),
('36653000', 'Kawasaki disease', 'diagnoses', 'Paediatrics'),
('19943007', 'Henoch-Schonlein purpura', 'diagnoses', 'Paediatrics'),
('38341003', 'Essential hypertension in children', 'diagnoses', 'Paediatrics'),
('118940003', 'Febrile seizures', 'diagnoses', 'Paediatrics')
ON CONFLICT (snomed_code) DO NOTHING;