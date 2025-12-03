-- Batch 53: Additional surgical procedures
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('116142004', 'Resection anterior', 'surgeries', 'Colorectal'),
('265758003', 'Abdominoperineal resection', 'surgeries', 'Colorectal'),
('13908001', 'Colostomy', 'surgeries', 'Colorectal'),
('173422009', 'Ileostomy', 'surgeries', 'Colorectal'),
('397956004', 'Parathyroidectomy', 'surgeries', 'Endocrine'),
('302352004', 'Adrenalectomy', 'surgeries', 'Endocrine'),
('35025007', 'Hypophysectomy', 'surgeries', 'Neurosurgery'),
('387687006', 'Partial nephrectomy', 'surgeries', 'Urology'),
('236936007', 'Nephrolithotomy', 'surgeries', 'Urology'),
('174855009', 'Cystectomy', 'surgeries', 'Urology'),
('265795005', 'Transurethral resection of prostate', 'surgeries', 'Urology'),
('176105009', 'Orchidectomy', 'surgeries', 'Urology'),
('287664005', 'Shoulder arthroscopy', 'surgeries', 'Orthopaedic'),
('609588000', 'Total knee replacement revision', 'surgeries', 'Orthopaedic'),
('116783008', 'Total hip replacement revision', 'surgeries', 'Orthopaedic')
ON CONFLICT (snomed_code) DO NOTHING;