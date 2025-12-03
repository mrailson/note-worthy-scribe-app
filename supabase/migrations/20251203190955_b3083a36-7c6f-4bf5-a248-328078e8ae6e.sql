-- Batch 29: Women's health
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('129103003', 'Endometriosis', 'diagnoses', 'Gynaecology'),
('69878008', 'Polycystic ovary syndrome', 'diagnoses', 'Gynaecology'),
('95315005', 'Uterine fibroids', 'diagnoses', 'Gynaecology'),
('198130006', 'Menorrhagia', 'diagnoses', 'Gynaecology'),
('14302001', 'Dysmenorrhoea', 'diagnoses', 'Gynaecology'),
('237091009', 'Premature menopause', 'diagnoses', 'Gynaecology'),
('276319003', 'Recurrent miscarriage', 'diagnoses', 'Gynaecology'),
('1474004', 'Hypertensive disorder of pregnancy', 'diagnoses', 'Obstetrics'),
('11687002', 'Gestational diabetes', 'diagnoses', 'Obstetrics'),
('75258004', 'Pelvic inflammatory disease', 'diagnoses', 'Gynaecology'),
('102878001', 'Cervical intraepithelial neoplasia', 'diagnoses', 'Gynaecology'),
('363354003', 'Ovarian cancer', 'diagnoses', 'Gynaecology'),
('254878006', 'Breast cancer', 'diagnoses', 'Oncology'),
('198246001', 'Vulval intraepithelial neoplasia', 'diagnoses', 'Gynaecology'),
('85828009', 'Autoimmune oophoritis', 'diagnoses', 'Gynaecology')
ON CONFLICT (snomed_code) DO NOTHING;