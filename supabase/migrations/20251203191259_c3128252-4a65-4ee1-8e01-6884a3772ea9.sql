-- Batch 60: Genetic conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('8876000', 'Turner syndrome', 'diagnoses', 'Genetics'),
('405769009', 'Klinefelter syndrome', 'diagnoses', 'Genetics'),
('230305005', 'Prader-Willi syndrome', 'diagnoses', 'Genetics'),
('76880004', 'Angelman syndrome', 'diagnoses', 'Genetics'),
('89770005', 'Marfan syndrome', 'diagnoses', 'Genetics'),
('76880004', 'Ehlers-Danlos syndrome', 'diagnoses', 'Genetics'),
('261001', 'Neurofibromatosis type 1', 'diagnoses', 'Genetics'),
('92503002', 'Neurofibromatosis type 2', 'diagnoses', 'Genetics'),
('398036000', 'Tuberous sclerosis', 'diagnoses', 'Genetics'),
('68544003', 'Von Hippel-Lindau disease', 'diagnoses', 'Genetics'),
('419076005', 'BRCA1 gene mutation', 'diagnoses', 'Genetics'),
('419724005', 'BRCA2 gene mutation', 'diagnoses', 'Genetics'),
('315047002', 'Lynch syndrome', 'diagnoses', 'Genetics'),
('398943008', 'Familial adenomatous polyposis', 'diagnoses', 'Genetics'),
('58756001', 'Alpha-1 antitrypsin deficiency', 'diagnoses', 'Genetics')
ON CONFLICT (snomed_code) DO NOTHING;