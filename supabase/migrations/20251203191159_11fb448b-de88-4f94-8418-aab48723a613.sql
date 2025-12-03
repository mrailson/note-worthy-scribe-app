-- Batch 51: Falls and frailty
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('161898004', 'History of falls', 'diagnoses', 'Geriatrics'),
('248278004', 'At risk of falls', 'diagnoses', 'Geriatrics'),
('713634000', 'Frailty', 'diagnoses', 'Geriatrics'),
('248279007', 'Mild frailty', 'diagnoses', 'Geriatrics'),
('248280005', 'Moderate frailty', 'diagnoses', 'Geriatrics'),
('248281009', 'Severe frailty', 'diagnoses', 'Geriatrics'),
('129839007', 'At risk of pressure ulcers', 'diagnoses', 'Geriatrics'),
('420226006', 'Pressure ulcer', 'diagnoses', 'Geriatrics'),
('129588001', 'Adult safeguarding concern', 'diagnoses', 'Safeguarding'),
('134436002', 'Child safeguarding concern', 'diagnoses', 'Safeguarding'),
('183963003', 'Vulnerable adult', 'diagnoses', 'Safeguarding'),
('416432009', 'Capacity assessment', 'diagnoses', 'Geriatrics'),
('225544001', 'Lasting power of attorney', 'diagnoses', 'Legal'),
('310499004', 'Best interests decision', 'diagnoses', 'Legal'),
('416402001', 'DOLS in place', 'diagnoses', 'Legal')
ON CONFLICT (snomed_code) DO NOTHING;