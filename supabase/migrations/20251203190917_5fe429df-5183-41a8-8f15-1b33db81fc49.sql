-- Batch 23: Musculoskeletal conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('69896004', 'Rheumatoid arthritis', 'diagnoses', 'Musculoskeletal'),
('396275006', 'Osteoarthritis', 'diagnoses', 'Musculoskeletal'),
('203082005', 'Fibromyalgia', 'diagnoses', 'Musculoskeletal'),
('36989005', 'Gout', 'diagnoses', 'Musculoskeletal'),
('64859006', 'Osteoporosis', 'diagnoses', 'Musculoskeletal'),
('239873007', 'Ankylosing spondylitis', 'diagnoses', 'Musculoskeletal'),
('201436003', 'Psoriatic arthritis', 'diagnoses', 'Musculoskeletal'),
('55146009', 'Polymyalgia rheumatica', 'diagnoses', 'Musculoskeletal'),
('396332003', 'Systemic lupus erythematosus', 'diagnoses', 'Musculoskeletal'),
('31996006', 'Vasculitis', 'diagnoses', 'Musculoskeletal'),
('239872002', 'Reactive arthritis', 'diagnoses', 'Musculoskeletal'),
('396230008', 'Sjogren syndrome', 'diagnoses', 'Musculoskeletal'),
('81573002', 'Dermatomyositis', 'diagnoses', 'Musculoskeletal'),
('31384009', 'Polymyositis', 'diagnoses', 'Musculoskeletal'),
('89155008', 'Systemic sclerosis', 'diagnoses', 'Musculoskeletal')
ON CONFLICT (snomed_code) DO NOTHING;