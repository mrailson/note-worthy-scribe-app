-- Batch 56: Pregnancy related
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('72892002', 'Normal pregnancy', 'diagnoses', 'Obstetrics'),
('127364007', 'Ectopic pregnancy', 'diagnoses', 'Obstetrics'),
('17382005', 'Miscarriage', 'diagnoses', 'Obstetrics'),
('161748004', 'First trimester pregnancy', 'diagnoses', 'Obstetrics'),
('161751001', 'Second trimester pregnancy', 'diagnoses', 'Obstetrics'),
('161753003', 'Third trimester pregnancy', 'diagnoses', 'Obstetrics'),
('289903006', 'Hyperemesis gravidarum', 'diagnoses', 'Obstetrics'),
('398254007', 'Pre-eclampsia', 'diagnoses', 'Obstetrics'),
('15938005', 'Eclampsia', 'diagnoses', 'Obstetrics'),
('17382005', 'Threatened miscarriage', 'diagnoses', 'Obstetrics'),
('58532003', 'Placenta praevia', 'diagnoses', 'Obstetrics'),
('27858009', 'Placental abruption', 'diagnoses', 'Obstetrics'),
('199223000', 'Intrauterine growth restriction', 'diagnoses', 'Obstetrics'),
('267014000', 'Preterm labour', 'diagnoses', 'Obstetrics'),
('21296001', 'Postpartum haemorrhage', 'diagnoses', 'Obstetrics')
ON CONFLICT (snomed_code) DO NOTHING;