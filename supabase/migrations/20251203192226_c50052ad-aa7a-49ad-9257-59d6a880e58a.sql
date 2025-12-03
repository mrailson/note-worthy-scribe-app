-- Batch 107-112: Musculoskeletal and Rheumatology
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
-- Inflammatory arthritis
('69896004', 'Rheumatoid arthritis', 'Rheumatology'),
('201790003', 'Seropositive rheumatoid arthritis', 'Rheumatology'),
('239792003', 'Seronegative rheumatoid arthritis', 'Rheumatology'),
('156471009', 'Psoriatic arthritis', 'Rheumatology'),
('410795001', 'Reactive arthritis', 'Rheumatology'),
('9631008', 'Ankylosing spondylitis', 'Rheumatology'),
('239873007', 'Axial spondyloarthritis', 'Rheumatology'),
-- Connective tissue diseases
('55464009', 'Systemic lupus erythematosus', 'Rheumatology'),
('200936003', 'Lupus nephritis', 'Rheumatology'),
('31996006', 'Vasculitis', 'Rheumatology'),
('239934006', 'Giant cell arteritis', 'Rheumatology'),
('72377000', 'Polymyalgia rheumatica', 'Rheumatology'),
('396230008', 'Dermatomyositis', 'Rheumatology'),
('31384009', 'Polymyositis', 'Rheumatology'),
('89155008', 'Systemic sclerosis', 'Rheumatology'),
('201443004', 'Limited cutaneous systemic sclerosis', 'Rheumatology'),
('239886003', 'Diffuse cutaneous systemic sclerosis', 'Rheumatology'),
-- Other rheumatological
('31541009', 'Sjogren syndrome', 'Rheumatology'),
('239873007', 'Mixed connective tissue disease', 'Rheumatology'),
('396232000', 'Antiphospholipid syndrome', 'Rheumatology'),
('195353004', 'Gout', 'Rheumatology'),
('238792006', 'Pseudogout', 'Rheumatology'),
('414916001', 'Osteoporosis', 'Musculoskeletal'),
('64859006', 'Osteopenia', 'Musculoskeletal'),
('203082005', 'Fibromyalgia', 'Musculoskeletal')
ON CONFLICT (snomed_code) DO NOTHING;