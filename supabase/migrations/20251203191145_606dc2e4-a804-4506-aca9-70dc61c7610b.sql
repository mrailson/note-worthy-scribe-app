-- Batch 48: Orthopaedic conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('13769002', 'Rotator cuff tear', 'diagnoses', 'Orthopaedics'),
('202855006', 'Frozen shoulder', 'diagnoses', 'Orthopaedics'),
('67849003', 'Tennis elbow', 'diagnoses', 'Orthopaedics'),
('202855006', 'Golfer elbow', 'diagnoses', 'Orthopaedics'),
('239873007', 'Trigger finger', 'diagnoses', 'Orthopaedics'),
('202855006', 'De Quervain tenosynovitis', 'diagnoses', 'Orthopaedics'),
('77075001', 'Plantar fasciitis', 'diagnoses', 'Orthopaedics'),
('239873007', 'Achilles tendinitis', 'diagnoses', 'Orthopaedics'),
('239720000', 'Baker cyst', 'diagnoses', 'Orthopaedics'),
('48377002', 'Meniscal tear', 'diagnoses', 'Orthopaedics'),
('239872002', 'ACL injury', 'diagnoses', 'Orthopaedics'),
('64217002', 'Hip labral tear', 'diagnoses', 'Orthopaedics'),
('239720000', 'Femoral acetabular impingement', 'diagnoses', 'Orthopaedics'),
('18099001', 'Osteochondritis dissecans', 'diagnoses', 'Orthopaedics'),
('23406007', 'Scoliosis', 'diagnoses', 'Orthopaedics')
ON CONFLICT (snomed_code) DO NOTHING;